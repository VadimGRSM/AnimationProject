from datetime import timedelta
import io
import json
import tempfile
import zipfile

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.http import Http404
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from .access import (
    can_edit_project,
    can_manage_project,
    can_view_project,
    get_accessible_project_or_404,
    get_editable_project_or_404,
    get_manageable_project_or_404,
    get_project_membership,
    get_project_role,
)
from .services.invite_service import PENDING_PROJECT_INVITE_SESSION_KEY
from .models import AnimationProject, Frame, ProjectInvite, ProjectMember

User = get_user_model()


def _make_png_bytes(size=(64, 64), color=(255, 0, 0, 255)):
    from PIL import Image

    image = Image.new('RGBA', size, color)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return buffer.getvalue()


class ExportSmokeTests(TestCase):
    def test_export_png_zip_and_gif(self):
        with tempfile.TemporaryDirectory() as tmp_media_root:
            with override_settings(MEDIA_ROOT=tmp_media_root):
                user = User.objects.create_user(email="export_test@example.com", password="test")
                project = AnimationProject.objects.create(
                    owner=user,
                    title='Export Test',
                    width=64,
                    height=64,
                    fps=12,
                )

                colors = [
                    (255, 0, 0, 255),
                    (0, 255, 0, 255),
                    (0, 0, 255, 255),
                ]
                for index, color in enumerate(colors, start=1):
                    frame = Frame.objects.create(project=project, index=index)
                    png_bytes = _make_png_bytes(size=(64, 64), color=color)
                    frame.preview_image.save(
                        f'project_{project.pk}_frame_{index}.png',
                        ContentFile(png_bytes),
                        save=True,
                    )

                client = Client()
                client.force_login(user)
                export_url = reverse('animation:project_export', kwargs={'pk': project.pk})

                # PNG ZIP
                response = client.post(
                    export_url,
                    data=json.dumps({
                        'format': 'png_zip',
                        'resolution': 'original',
                        'fps': 12,
                    }),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertIn('download_url', payload)

                download = client.get(payload['download_url'])
                self.assertEqual(download.status_code, 200)
                zip_bytes = b''.join(download.streaming_content)
                zf = zipfile.ZipFile(io.BytesIO(zip_bytes), mode='r')
                names = sorted(zf.namelist())
                self.assertEqual(names, ['frame_0001.png', 'frame_0002.png', 'frame_0003.png'])
                for name in names:
                    data = zf.read(name)
                    self.assertTrue(data.startswith(b'\x89PNG\r\n\x1a\n'))

                # GIF
                response = client.post(
                    export_url,
                    data=json.dumps({
                        'format': 'gif',
                        'resolution': '720p',
                        'fps': 12,
                        'loop_infinite': True,
                        'loop_count': 0,
                    }),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertIn('download_url', payload)

                download = client.get(payload['download_url'])
                self.assertEqual(download.status_code, 200)
                gif_bytes = b''.join(download.streaming_content)
                self.assertTrue(gif_bytes.startswith(b'GIF8'))


class CollaborationModelsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@example.com', password='test')
        self.other_user = User.objects.create_user(email='viewer@example.com', password='test')

    def test_project_creation_creates_owner_membership(self):
        project = AnimationProject.objects.create(
            owner=self.owner,
            title='Shared project',
            width=1280,
            height=720,
            fps=12,
        )

        membership = ProjectMember.objects.get(project=project, user=self.owner)
        self.assertEqual(membership.role, ProjectMember.Role.OWNER)
        self.assertTrue(membership.is_active)
        self.assertTrue(membership.can_edit())
        self.assertTrue(membership.can_view())
        self.assertTrue(membership.can_manage_members())

    def test_project_save_restores_owner_membership_rights(self):
        project = AnimationProject.objects.create(
            owner=self.owner,
            title='Shared project',
            width=1280,
            height=720,
            fps=12,
        )
        membership = ProjectMember.objects.get(project=project, user=self.owner)
        membership.role = ProjectMember.Role.VIEWER
        membership.is_active = False
        membership.save(update_fields=['role', 'is_active'])

        project.title = 'Renamed project'
        project.save(update_fields=['title'])

        membership.refresh_from_db()
        self.assertEqual(membership.role, ProjectMember.Role.OWNER)
        self.assertTrue(membership.is_active)

    def test_project_invite_helpers(self):
        project = AnimationProject.objects.create(
            owner=self.owner,
            title='Invite project',
            width=1280,
            height=720,
            fps=12,
        )
        invite = ProjectInvite.objects.create(
            project=project,
            email='viewer@example.com',
            role=ProjectInvite.Role.EDITOR,
            invited_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
        )

        self.assertFalse(invite.is_expired())
        self.assertTrue(invite.is_pending())
        self.assertTrue(invite.can_be_accepted_by(self.other_user))

    def test_expired_invite_cannot_be_accepted(self):
        project = AnimationProject.objects.create(
            owner=self.owner,
            title='Expired invite project',
            width=1280,
            height=720,
            fps=12,
        )
        invite = ProjectInvite.objects.create(
            project=project,
            email='viewer@example.com',
            role=ProjectInvite.Role.VIEWER,
            invited_by=self.owner,
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        self.assertTrue(invite.is_expired())
        self.assertFalse(invite.is_pending())
        self.assertFalse(invite.can_be_accepted_by(self.other_user))


class ProjectAccessTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@example.com', password='test')
        self.editor = User.objects.create_user(email='editor@example.com', password='test')
        self.viewer = User.objects.create_user(email='viewer@example.com', password='test')
        self.outsider = User.objects.create_user(email='outsider@example.com', password='test')

        self.project = AnimationProject.objects.create(
            owner=self.owner,
            title='Shared storyboard',
            width=1280,
            height=720,
            fps=12,
        )
        self.frame = Frame.objects.create(project=self.project, index=1, content_json='{}')

        ProjectMember.objects.create(
            project=self.project,
            user=self.editor,
            role=ProjectMember.Role.EDITOR,
            invited_by=self.owner,
        )
        ProjectMember.objects.create(
            project=self.project,
            user=self.viewer,
            role=ProjectMember.Role.VIEWER,
            invited_by=self.owner,
        )

    def test_access_helpers_return_expected_permissions(self):
        owner_membership = get_project_membership(self.owner, self.project)
        self.assertIsNotNone(owner_membership)
        self.assertEqual(get_project_role(self.owner, self.project), ProjectMember.Role.OWNER)
        self.assertEqual(get_project_role(self.editor, self.project), ProjectMember.Role.EDITOR)
        self.assertEqual(get_project_role(self.viewer, self.project), ProjectMember.Role.VIEWER)
        self.assertIsNone(get_project_role(self.outsider, self.project))

        self.assertTrue(can_view_project(self.viewer, self.project))
        self.assertFalse(can_edit_project(self.viewer, self.project))
        self.assertFalse(can_manage_project(self.viewer, self.project))

        self.assertTrue(can_view_project(self.editor, self.project))
        self.assertTrue(can_edit_project(self.editor, self.project))
        self.assertFalse(can_manage_project(self.editor, self.project))

        self.assertTrue(can_manage_project(self.owner, self.project))

    def test_project_lookup_helpers_enforce_role_boundaries(self):
        self.assertEqual(get_accessible_project_or_404(self.viewer, self.project.pk), self.project)
        self.assertEqual(get_editable_project_or_404(self.editor, self.project.pk), self.project)
        self.assertEqual(get_manageable_project_or_404(self.owner, self.project.pk), self.project)

        with self.assertRaises(Http404):
            get_editable_project_or_404(self.viewer, self.project.pk)

        with self.assertRaises(Http404):
            get_manageable_project_or_404(self.editor, self.project.pk)

        with self.assertRaises(Http404):
            get_accessible_project_or_404(self.outsider, self.project.pk)

    def test_share_page_is_owner_only(self):
        owner_client = Client()
        owner_client.force_login(self.owner)

        owner_response = owner_client.get(reverse('animation:project_share', kwargs={'pk': self.project.pk}))
        self.assertEqual(owner_response.status_code, 200)
        self.assertContains(owner_response, 'Invite by email')
        self.assertContains(owner_response, 'Current members')
        self.assertContains(owner_response, 'Pending invites')

        editor_client = Client()
        editor_client.force_login(self.editor)
        editor_response = editor_client.get(reverse('animation:project_share', kwargs={'pk': self.project.pk}))
        self.assertEqual(editor_response.status_code, 404)

    def test_project_list_includes_shared_projects_for_viewer(self):
        owned_project = AnimationProject.objects.create(
            owner=self.viewer,
            title='My own short',
            width=1920,
            height=1080,
            fps=24,
        )
        client = Client()
        client.force_login(self.viewer)

        response = client.get(reverse('animation:project_list'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Shared storyboard')
        self.assertContains(response, 'My own short')
        self.assertContains(response, 'My projects')
        self.assertContains(response, 'Shared with me')
        self.assertEqual(len(response.context['project_cards']), 2)
        self.assertEqual(len(response.context['owned_project_cards']), 1)
        self.assertEqual(len(response.context['shared_project_cards']), 1)
        owned_card = response.context['owned_project_cards'][0]
        shared_card = response.context['shared_project_cards'][0]
        self.assertEqual(owned_card['id'], owned_project.pk)
        self.assertEqual(owned_card['current_user_role'], ProjectMember.Role.OWNER)
        self.assertEqual(shared_card['id'], self.project.pk)
        self.assertEqual(shared_card['current_user_role'], ProjectMember.Role.VIEWER)
        self.assertFalse(shared_card['can_edit'])
        self.assertFalse(shared_card['can_manage_members'])
        self.assertEqual(shared_card['owner_display'], self.owner.display_name)
        self.assertIn('share_url', owned_card)

    def test_viewer_has_read_only_access_in_views(self):
        client = Client()
        client.force_login(self.viewer)

        editor_response = client.get(reverse('animation:project_editor', kwargs={'pk': self.project.pk}))
        self.assertEqual(editor_response.status_code, 200)
        self.assertEqual(editor_response.context['current_user_role'], ProjectMember.Role.VIEWER)
        self.assertFalse(editor_response.context['can_edit'])
        self.assertFalse(editor_response.context['can_manage_members'])
        self.assertContains(editor_response, 'data-can-edit="false"')
        self.assertContains(editor_response, 'data-can-manage-members="false"')
        self.assertContains(editor_response, 'Read only')

        frames_response = client.get(reverse('animation:frames_list', kwargs={'pk': self.project.pk}))
        self.assertEqual(frames_response.status_code, 200)

        save_response = client.post(
            reverse('animation:project_save', kwargs={'pk': self.project.pk}),
            data=json.dumps({'frames': [{'index': 1, 'content': '{}'}]}),
            content_type='application/json',
        )
        self.assertEqual(save_response.status_code, 404)

    def test_editor_can_edit_but_cannot_delete_project(self):
        client = Client()
        client.force_login(self.editor)

        update_response = client.post(
            reverse('animation:project_update', kwargs={'pk': self.project.pk}),
            data=json.dumps({'fps': 24}),
            content_type='application/json',
        )
        self.assertEqual(update_response.status_code, 200)

        self.project.refresh_from_db()
        self.assertEqual(self.project.fps, 24)

        delete_response = client.post(reverse('animation:project_delete', kwargs={'pk': self.project.pk}))
        self.assertEqual(delete_response.status_code, 404)

    def test_editor_can_update_project_dimensions(self):
        client = Client()
        client.force_login(self.editor)

        response = client.post(
            reverse('animation:project_update', kwargs={'pk': self.project.pk}),
            data=json.dumps({'width': 1600, 'height': 900}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.width, 1600)
        self.assertEqual(self.project.height, 900)

    def test_project_rename_is_owner_only(self):
        client = Client()
        client.force_login(self.editor)

        response = client.post(
            reverse('animation:project_rename', kwargs={'pk': self.project.pk}),
            data={'project_id': str(self.project.pk), 'new_title': 'Renamed by editor'},
        )

        self.assertEqual(response.status_code, 404)

        client.force_login(self.owner)
        owner_response = client.post(
            reverse('animation:project_rename', kwargs={'pk': self.project.pk}),
            data={'project_id': str(self.project.pk), 'new_title': 'Renamed by owner'},
        )
        self.assertEqual(owner_response.status_code, 302)

        self.project.refresh_from_db()
        self.assertEqual(self.project.title, 'Renamed by owner')

    def test_owner_can_change_member_role_and_remove_member(self):
        client = Client()
        client.force_login(self.owner)

        viewer_membership = ProjectMember.objects.get(project=self.project, user=self.viewer)
        role_response = client.post(
            reverse(
                'animation:project_member_role_update',
                kwargs={'pk': self.project.pk, 'member_id': viewer_membership.pk},
            ),
            data={'role': ProjectMember.Role.EDITOR},
        )
        self.assertEqual(role_response.status_code, 302)

        viewer_membership.refresh_from_db()
        self.assertEqual(viewer_membership.role, ProjectMember.Role.EDITOR)

        editor_membership = ProjectMember.objects.get(project=self.project, user=self.editor)
        remove_response = client.post(
            reverse(
                'animation:project_member_remove',
                kwargs={'pk': self.project.pk, 'member_id': editor_membership.pk},
            ),
        )
        self.assertEqual(remove_response.status_code, 302)
        self.assertFalse(ProjectMember.objects.filter(pk=editor_membership.pk).exists())


class ProjectInviteFlowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@example.com', password='test')
        self.editor = User.objects.create_user(email='editor@example.com', password='test')
        self.invited_user = User.objects.create_user(email='invitee@example.com', password='test')
        self.wrong_user = User.objects.create_user(email='wrong@example.com', password='test')

        self.project = AnimationProject.objects.create(
            owner=self.owner,
            title='Inviteable project',
            width=1280,
            height=720,
            fps=12,
        )
        ProjectMember.objects.create(
            project=self.project,
            user=self.editor,
            role=ProjectMember.Role.EDITOR,
            invited_by=self.owner,
        )

    def test_owner_can_create_invite_and_get_link(self):
        client = Client()
        client.force_login(self.owner)

        response = client.post(
            reverse('animation:project_invite_create', kwargs={'pk': self.project.pk}),
            data=json.dumps({'email': 'invitee@example.com', 'role': ProjectInvite.Role.EDITOR}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['ok'])
        invite = ProjectInvite.objects.get(project=self.project, email='invitee@example.com')
        self.assertEqual(invite.role, ProjectInvite.Role.EDITOR)
        self.assertIn(invite.token, payload['invite']['invite_url'])

    def test_non_owner_cannot_create_invite(self):
        client = Client()
        client.force_login(self.editor)

        response = client.post(
            reverse('animation:project_invite_create', kwargs={'pk': self.project.pk}),
            data=json.dumps({'email': 'new@example.com', 'role': ProjectInvite.Role.VIEWER}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 404)

    def test_cannot_create_duplicate_active_invite_or_invite_existing_member(self):
        ProjectInvite.objects.create(
            project=self.project,
            email='invitee@example.com',
            role=ProjectInvite.Role.VIEWER,
            invited_by=self.owner,
            expires_at=timezone.now() + timedelta(days=3),
        )

        client = Client()
        client.force_login(self.owner)

        duplicate_response = client.post(
            reverse('animation:project_invite_create', kwargs={'pk': self.project.pk}),
            data=json.dumps({'email': 'invitee@example.com', 'role': ProjectInvite.Role.EDITOR}),
            content_type='application/json',
        )
        self.assertEqual(duplicate_response.status_code, 400)
        self.assertEqual(duplicate_response.json()['error'], 'invite_exists')

        member_response = client.post(
            reverse('animation:project_invite_create', kwargs={'pk': self.project.pk}),
            data=json.dumps({'email': 'editor@example.com', 'role': ProjectInvite.Role.VIEWER}),
            content_type='application/json',
        )
        self.assertEqual(member_response.status_code, 400)
        self.assertEqual(member_response.json()['error'], 'already_member')

    def test_invite_detail_redirects_anonymous_user_to_login_and_saves_token(self):
        invite = ProjectInvite.objects.create(
            project=self.project,
            email='invitee@example.com',
            role=ProjectInvite.Role.VIEWER,
            invited_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
        )

        response = self.client.get(reverse('animation:invite_detail', kwargs={'token': invite.token}))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('account_login'), response.url)
        self.assertEqual(self.client.session.get(PENDING_PROJECT_INVITE_SESSION_KEY), invite.token)

    def test_accept_invite_creates_membership_and_marks_invite_accepted(self):
        invite = ProjectInvite.objects.create(
            project=self.project,
            email='invitee@example.com',
            role=ProjectInvite.Role.EDITOR,
            invited_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
        )

        client = Client()
        client.force_login(self.invited_user)

        response = client.post(reverse('animation:invite_accept', kwargs={'token': invite.token}))

        self.assertEqual(response.status_code, 302)
        membership = ProjectMember.objects.get(project=self.project, user=self.invited_user)
        self.assertEqual(membership.role, ProjectMember.Role.EDITOR)
        invite.refresh_from_db()
        self.assertEqual(invite.status, ProjectInvite.Status.ACCEPTED)
        self.assertEqual(invite.accepted_by, self.invited_user)
        self.assertIsNotNone(invite.accepted_at)

    def test_accept_invite_rejects_wrong_email(self):
        invite = ProjectInvite.objects.create(
            project=self.project,
            email='invitee@example.com',
            role=ProjectInvite.Role.VIEWER,
            invited_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
        )

        client = Client()
        client.force_login(self.wrong_user)

        response = client.post(reverse('animation:invite_accept', kwargs={'token': invite.token}))

        self.assertEqual(response.status_code, 302)
        self.assertFalse(ProjectMember.objects.filter(project=self.project, user=self.wrong_user).exists())
        invite.refresh_from_db()
        self.assertEqual(invite.status, ProjectInvite.Status.PENDING)

    def test_owner_can_revoke_invite(self):
        invite = ProjectInvite.objects.create(
            project=self.project,
            email='revoked@example.com',
            role=ProjectInvite.Role.VIEWER,
            invited_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
        )

        client = Client()
        client.force_login(self.owner)

        response = client.post(
            reverse(
                'animation:project_invite_revoke',
                kwargs={'pk': self.project.pk, 'invite_id': invite.pk},
            ),
        )

        self.assertEqual(response.status_code, 200)
        invite.refresh_from_db()
        self.assertEqual(invite.status, ProjectInvite.Status.REVOKED)

        share_response = client.get(reverse('animation:project_share', kwargs={'pk': self.project.pk}))
        self.assertEqual(share_response.status_code, 200)
        self.assertNotContains(share_response, 'revoked@example.com')


class FrameSaveLimitsTests(TestCase):
    def test_frame_save_returns_413_when_request_body_is_too_large(self):
        user = User.objects.create_user(email='save-limit@example.com', password='test')
        project = AnimationProject.objects.create(
            owner=user,
            title='Body limit project',
            width=1280,
            height=720,
            fps=12,
        )
        frame = Frame.objects.create(project=project, index=1)

        client = Client()
        client.force_login(user)

        oversized_payload = json.dumps({
            'image_data': 'x' * 2048,
            'content_json': '{}',
        })

        with override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=256):
            response = client.post(
                reverse('animation:frame_save', kwargs={'pk': project.pk, 'index': frame.index}),
                data=oversized_payload,
                content_type='application/json',
            )

        self.assertEqual(response.status_code, 413)
        self.assertFalse(response.json()['ok'])
        self.assertIn('Maximum request size', response.json()['error'])
