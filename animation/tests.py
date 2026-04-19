from datetime import timedelta
import io
import json
import tempfile
import zipfile
from unittest import mock

from asgiref.sync import async_to_sync, sync_to_async
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.http import Http404
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from animstudio.asgi import application
from .access import (
    can_edit_project,
    can_manage_project,
    can_view_project,
    get_accessible_project_or_404,
    get_editable_project_or_404,
    get_manageable_project_or_404,
    get_project_connection_context,
    get_project_membership,
    get_project_membership_for_user,
    get_project_role,
    user_can_access_project,
)
from .consumers import ProjectConsumer
from .locks import acquire_layer_lock, cleanup_stale_layer_locks, heartbeat_layer_lock, release_layer_locks
from .services.invite_service import PENDING_PROJECT_INVITE_SESSION_KEY
from .models import AnimationProject, Frame, FrameLock, Layer, LayerLock, ProjectInvite, ProjectMember, ProjectPresenceSession

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


class LayerLockSemanticsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='lock-owner@example.com', password='test')
        self.editor = User.objects.create_user(email='lock-editor@example.com', password='test')
        self.project = AnimationProject.objects.create(
            owner=self.owner,
            title='Layer lock semantics',
            width=1280,
            height=720,
            fps=12,
        )
        self.frame = Frame.objects.create(project=self.project, index=1, content_json='{}')
        self.layer_one = Layer.objects.create(
            frame=self.frame,
            order=1,
            name='Background',
            visible=True,
            opacity=100,
        )
        self.layer_two = Layer.objects.create(
            frame=self.frame,
            order=2,
            name='Ink',
            visible=True,
            opacity=100,
        )
        ProjectMember.objects.create(
            project=self.project,
            user=self.editor,
            role=ProjectMember.Role.EDITOR,
            invited_by=self.owner,
        )

    def _create_presence_session(self, user, role, *, is_active=True, last_seen_at=None):
        now = last_seen_at or timezone.now()
        return ProjectPresenceSession.objects.create(
            project=self.project,
            user=user,
            channel_name=f'layer-lock-{user.pk}-{ProjectPresenceSession.objects.count() + 1}',
            current_frame=self.frame,
            role=role,
            last_seen_at=now,
            is_active=is_active,
        )

    def test_same_session_releases_previous_layer_lock_when_switching_layers(self):
        presence_session = self._create_presence_session(self.owner, ProjectMember.Role.OWNER)

        first_lock_state = acquire_layer_lock(
            project_id=self.project.pk,
            frame_id=self.frame.pk,
            layer_id=self.layer_one.pk,
            user_id=self.owner.pk,
            role=ProjectMember.Role.OWNER,
            presence_session_id=presence_session.pk,
        )
        second_lock_state = acquire_layer_lock(
            project_id=self.project.pk,
            frame_id=self.frame.pk,
            layer_id=self.layer_two.pk,
            user_id=self.owner.pk,
            role=ProjectMember.Role.OWNER,
            presence_session_id=presence_session.pk,
        )

        self.assertEqual(first_lock_state['status'], 'acquired')
        self.assertEqual(second_lock_state['status'], 'acquired')
        self.assertEqual(
            [lock['layer_id'] for lock in second_lock_state['released']],
            [self.layer_one.pk],
        )
        self.assertEqual(
            LayerLock.objects.filter(project=self.project, presence_session=presence_session).count(),
            1,
        )
        remaining_lock = LayerLock.objects.get(project=self.project, presence_session=presence_session)
        self.assertEqual(remaining_lock.layer_id, self.layer_two.pk)

    def test_different_session_cannot_take_locked_layer(self):
        owner_presence = self._create_presence_session(self.owner, ProjectMember.Role.OWNER)
        editor_presence = self._create_presence_session(self.editor, ProjectMember.Role.EDITOR)
        acquire_layer_lock(
            project_id=self.project.pk,
            frame_id=self.frame.pk,
            layer_id=self.layer_one.pk,
            user_id=self.owner.pk,
            role=ProjectMember.Role.OWNER,
            presence_session_id=owner_presence.pk,
        )

        denied_lock_state = acquire_layer_lock(
            project_id=self.project.pk,
            frame_id=self.frame.pk,
            layer_id=self.layer_one.pk,
            user_id=self.editor.pk,
            role=ProjectMember.Role.EDITOR,
            presence_session_id=editor_presence.pk,
        )

        self.assertEqual(denied_lock_state['status'], 'denied')
        self.assertEqual(denied_lock_state['reason'], 'locked_by_other')
        self.assertEqual(denied_lock_state['lock']['presence_session_id'], owner_presence.pk)
        self.assertEqual(LayerLock.objects.filter(project=self.project, layer=self.layer_one).count(), 1)

    def test_repeated_acquire_for_owned_layer_is_idempotent(self):
        presence_session = self._create_presence_session(self.owner, ProjectMember.Role.OWNER)

        acquire_layer_lock(
            project_id=self.project.pk,
            frame_id=self.frame.pk,
            layer_id=self.layer_one.pk,
            user_id=self.owner.pk,
            role=ProjectMember.Role.OWNER,
            presence_session_id=presence_session.pk,
        )
        original_lock = LayerLock.objects.get(project=self.project, layer=self.layer_one)
        reacquired_lock_state = acquire_layer_lock(
            project_id=self.project.pk,
            frame_id=self.frame.pk,
            layer_id=self.layer_one.pk,
            user_id=self.owner.pk,
            role=ProjectMember.Role.OWNER,
            presence_session_id=presence_session.pk,
        )
        refreshed_lock = LayerLock.objects.get(project=self.project, layer=self.layer_one)

        self.assertEqual(reacquired_lock_state['status'], 'acquired')
        self.assertEqual(reacquired_lock_state['released'], [])
        self.assertEqual(LayerLock.objects.filter(project=self.project, layer=self.layer_one).count(), 1)
        self.assertEqual(refreshed_lock.presence_session_id, presence_session.pk)
        self.assertGreaterEqual(refreshed_lock.expires_at, original_lock.expires_at)

    def test_layer_lock_release_and_heartbeat_flow(self):
        presence_session = self._create_presence_session(self.owner, ProjectMember.Role.OWNER)
        acquire_layer_lock(
            project_id=self.project.pk,
            frame_id=self.frame.pk,
            layer_id=self.layer_one.pk,
            user_id=self.owner.pk,
            role=ProjectMember.Role.OWNER,
            presence_session_id=presence_session.pk,
        )
        original_lock = LayerLock.objects.get(project=self.project, layer=self.layer_one)

        heartbeat_state = heartbeat_layer_lock(
            project_id=self.project.pk,
            layer_id=self.layer_one.pk,
            user_id=self.owner.pk,
            presence_session_id=presence_session.pk,
        )
        refreshed_lock = LayerLock.objects.get(project=self.project, layer=self.layer_one)
        released = release_layer_locks(
            project_id=self.project.pk,
            user_id=self.owner.pk,
            presence_session_id=presence_session.pk,
            layer_id=self.layer_one.pk,
        )

        self.assertTrue(heartbeat_state['updated'])
        self.assertEqual(heartbeat_state['released'], [])
        self.assertGreaterEqual(refreshed_lock.expires_at, original_lock.expires_at)
        self.assertEqual([lock['layer_id'] for lock in released], [self.layer_one.pk])
        self.assertFalse(LayerLock.objects.filter(project=self.project, layer=self.layer_one).exists())

    def test_stale_layer_locks_are_cleaned_up(self):
        now = timezone.now()
        stale_presence = self._create_presence_session(
            self.owner,
            ProjectMember.Role.OWNER,
            last_seen_at=now,
        )
        fresh_presence = self._create_presence_session(
            self.editor,
            ProjectMember.Role.EDITOR,
            last_seen_at=now,
        )
        LayerLock.objects.create(
            project=self.project,
            frame=self.frame,
            layer=self.layer_one,
            user=self.owner,
            presence_session=stale_presence,
            last_heartbeat_at=now - timedelta(minutes=2),
            expires_at=now - timedelta(seconds=1),
        )
        LayerLock.objects.create(
            project=self.project,
            frame=self.frame,
            layer=self.layer_two,
            user=self.editor,
            presence_session=fresh_presence,
            last_heartbeat_at=now,
            expires_at=now + timedelta(seconds=30),
        )

        released = cleanup_stale_layer_locks(project_id=self.project.pk, now=now)

        self.assertEqual([lock['layer_id'] for lock in released], [self.layer_one.pk])
        self.assertFalse(LayerLock.objects.filter(project=self.project, layer=self.layer_one).exists())
        self.assertTrue(LayerLock.objects.filter(project=self.project, layer=self.layer_two).exists())


class ProjectConsumerLayerLockCacheTests(TestCase):
    def test_reconnect_snapshot_restores_owned_layer_lock_cache(self):
        consumer = ProjectConsumer()
        consumer.presence_session_id = 77
        consumer.owned_layer_lock_ids = {999}

        consumer.replace_owned_layer_locks([
            {'layer_id': 11, 'presence_session_id': 77},
            {'layer_id': 12, 'presence_session_id': 55},
            {'layer_id': 13, 'presence_session_id': 77},
        ])

        self.assertEqual(consumer.owned_layer_lock_ids, {11, 13})

    def test_live_preview_authorization_uses_owned_layer_lock_cache(self):
        consumer = ProjectConsumer()
        consumer.presence_session_id = 101
        consumer.owned_layer_lock_ids = {21}

        with mock.patch(
            'animation.locks.LayerLock.objects.filter',
            side_effect=AssertionError('Live preview auth should not query layer locks'),
        ):
            self.assertTrue(
                consumer.can_stream_layer_preview({
                    'frame_id': 1,
                    'layer_id': 21,
                    'tool': 'brush',
                })
            )
            self.assertFalse(
                consumer.can_stream_layer_preview({
                    'frame_id': 1,
                    'layer_id': 22,
                    'tool': 'brush',
                })
            )
            self.assertFalse(
                consumer.can_stream_layer_preview({
                    'frame_id': 1,
                    'layer_id': 21,
                    'tool': 'fill',
                })
            )

    def test_live_preview_authorization_rejects_invalid_sequence_payloads(self):
        consumer = ProjectConsumer()
        consumer.presence_session_id = 101
        consumer.owned_layer_lock_ids = {21}

        self.assertFalse(
            consumer.can_stream_layer_preview({
                'frame_id': 1,
                'layer_id': 21,
                'tool': 'brush',
                'seq': 0,
            })
        )
        self.assertFalse(
            consumer.can_stream_layer_preview({
                'frame_id': 1,
                'layer_id': 21,
                'tool': 'brush',
                'base_revision': -1,
            })
        )
        self.assertFalse(
            consumer.can_stream_layer_preview({
                'frame_id': 1,
                'layer_id': 21,
                'tool': 'brush',
                'stroke_id': 123,
            })
        )


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

        viewer_ws_membership = get_project_membership_for_user(self.project.pk, self.viewer.pk)
        self.assertIsNotNone(viewer_ws_membership)
        self.assertEqual(viewer_ws_membership.role, ProjectMember.Role.VIEWER)
        self.assertTrue(user_can_access_project(self.project.pk, self.viewer.pk))
        self.assertFalse(user_can_access_project(self.project.pk, self.outsider.pk))
        self.assertEqual(
            get_project_connection_context(self.project.pk, self.editor.pk)["role"],
            ProjectMember.Role.EDITOR,
        )

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

    def test_editor_template_uses_frame_save_url_not_project_save_url(self):
        client = Client()
        client.force_login(self.editor)

        response = client.get(reverse('animation:project_editor', kwargs={'pk': self.project.pk}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-frame-save-url-template=')
        self.assertNotContains(response, 'data-project-save-url=')

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


TEST_CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}


@override_settings(CHANNEL_LAYERS=TEST_CHANNEL_LAYERS)
class ProjectWebsocketRoomTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner-ws@example.com', password='test')
        self.editor = User.objects.create_user(email='editor-ws@example.com', password='test')
        self.viewer = User.objects.create_user(email='viewer-ws@example.com', password='test')
        self.outsider = User.objects.create_user(email='outsider-ws@example.com', password='test')
        for user, avatar_name in (
            (self.owner, 'avatars/owner-ws.png'),
            (self.editor, 'avatars/editor-ws.png'),
            (self.viewer, 'avatars/viewer-ws.png'),
        ):
            user.avatar = avatar_name
            user.save(update_fields=['avatar'])

        self.project = AnimationProject.objects.create(
            owner=self.owner,
            title='Realtime room',
            width=1280,
            height=720,
            fps=12,
        )
        self.frame_one = Frame.objects.create(project=self.project, index=1, content_json='{}')
        self.frame_two = Frame.objects.create(project=self.project, index=2, content_json='{}')
        self.layer_one = Layer.objects.create(
            frame=self.frame_one,
            order=1,
            name='Background',
            visible=True,
            opacity=100,
        )
        self.layer_two = Layer.objects.create(
            frame=self.frame_one,
            order=2,
            name='Ink',
            visible=True,
            opacity=100,
        )
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
        self.auth_headers = {
            self.owner.pk: self._build_auth_headers(self.owner),
            self.editor.pk: self._build_auth_headers(self.editor),
            self.viewer.pk: self._build_auth_headers(self.viewer),
            self.outsider.pk: self._build_auth_headers(self.outsider),
        }
        self.owner_client = Client()
        self.owner_client.force_login(self.owner)
        self.editor_client = Client()
        self.editor_client.force_login(self.editor)
        self.viewer_client = Client()
        self.viewer_client.force_login(self.viewer)

    def _build_auth_headers(self, user):
        client = Client()
        client.force_login(user)
        session_cookie = client.cookies[settings.SESSION_COOKIE_NAME].value
        return [(b'cookie', f'{settings.SESSION_COOKIE_NAME}={session_cookie}'.encode())]

    async def _connect(self, user=None, project_id=None):
        headers = self.auth_headers[user.pk] if user is not None else []
        communicator = WebsocketCommunicator(
            application,
            f'/ws/projects/{project_id or self.project.pk}/',
            headers=headers,
        )
        connected, detail = await communicator.connect()
        return communicator, connected, detail

    async def _assert_member_can_connect(
        self,
        user,
        expected_role,
        expected_user_count=1,
        expected_lock_count=0,
        expected_layer_lock_count=0,
    ):
        communicator, connected, _ = await self._connect(user=user)
        self.assertTrue(connected)
        ready_event = await communicator.receive_json_from()
        self.assertEqual(ready_event['type'], 'connection_ready')
        self.assertEqual(ready_event['payload']['project_id'], self.project.pk)
        self.assertEqual(ready_event['payload']['user_id'], user.pk)
        self.assertEqual(ready_event['payload']['role'], expected_role)
        self.assertIsNotNone(ready_event['payload']['presence_session_id'])

        snapshot_event = await communicator.receive_json_from()
        self.assertEqual(snapshot_event['type'], 'presence_snapshot')
        self.assertEqual(snapshot_event['payload']['project_id'], self.project.pk)
        self.assertEqual(len(snapshot_event['payload']['users']), expected_user_count)

        self_user = next(
            (item for item in snapshot_event['payload']['users'] if item['user_id'] == user.pk),
            None,
        )
        self.assertIsNotNone(self_user)
        self.assertEqual(self_user['role'], expected_role)
        self.assertEqual(self_user['current_frame_id'], self.frame_one.pk)
        self.assertEqual(self_user['current_frame_index'], self.frame_one.index)
        self.assertEqual(self_user['display_name'], user.display_name)
        self.assertEqual(self_user['email'], user.email)
        self.assertEqual(self_user['avatar_url'], user.avatar_url)
        self.assertEqual(self_user['avatar_initial'], (user.display_name or user.email)[:1].upper())

        lock_snapshot_event = await communicator.receive_json_from()
        self.assertEqual(lock_snapshot_event['type'], 'frame_lock_snapshot')
        self.assertEqual(lock_snapshot_event['payload']['project_id'], self.project.pk)
        self.assertEqual(len(lock_snapshot_event['payload']['locks']), expected_lock_count)
        layer_lock_snapshot_event = await communicator.receive_json_from()
        self.assertEqual(layer_lock_snapshot_event['type'], 'layer_lock_snapshot')
        self.assertEqual(layer_lock_snapshot_event['payload']['project_id'], self.project.pk)
        self.assertEqual(len(layer_lock_snapshot_event['payload']['locks']), expected_layer_lock_count)
        return communicator, {
            'ready_event': ready_event,
            'presence_snapshot': snapshot_event,
            'lock_snapshot': lock_snapshot_event,
            'layer_lock_snapshot': layer_lock_snapshot_event,
            'presence_session_id': ready_event['payload']['presence_session_id'],
        }

    def _latest_presence_row(self, user_id):
        return ProjectPresenceSession.objects.filter(
            project_id=self.project.pk,
            user_id=user_id,
        ).order_by('-joined_at', '-id').first()

    def _active_presence_count(self, user_id):
        return ProjectPresenceSession.objects.filter(
            project_id=self.project.pk,
            user_id=user_id,
            is_active=True,
        ).count()

    def _frame_lock_row(self, frame_id):
        return FrameLock.objects.filter(
            project_id=self.project.pk,
            frame_id=frame_id,
        ).select_related('frame', 'user', 'presence_session').first()

    def _layer_lock_row(self, layer_id):
        return LayerLock.objects.filter(
            project_id=self.project.pk,
            layer_id=layer_id,
        ).select_related('frame', 'layer', 'user', 'presence_session').first()

    def test_anonymous_connection_is_rejected(self):
        async def scenario():
            communicator, connected, close_code = await self._connect()
            self.assertFalse(connected)
            self.assertEqual(close_code, 4401)

        async_to_sync(scenario)()

    def test_user_without_project_access_is_rejected(self):
        async def scenario():
            communicator, connected, close_code = await self._connect(user=self.outsider)
            self.assertFalse(connected)
            self.assertEqual(close_code, 4403)
            self.assertEqual(
                await database_sync_to_async(self._active_presence_count)(self.outsider.pk),
                0,
            )

        async_to_sync(scenario)()

    def test_connect_creates_presence_for_viewer(self):
        async def scenario():
            communicator, connection = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
            )
            self.assertEqual(connection['presence_snapshot']['payload']['users'][0]['user_id'], self.viewer.pk)

            presence_row = await database_sync_to_async(self._latest_presence_row)(self.viewer.pk)
            self.assertIsNotNone(presence_row)
            self.assertTrue(presence_row.is_active)
            self.assertEqual(presence_row.role, ProjectMember.Role.VIEWER)
            self.assertEqual(presence_row.current_frame_id, self.frame_one.pk)

            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_editor_can_connect(self):
        async def scenario():
            communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
            )
            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_owner_can_connect(self):
        async def scenario():
            communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_second_user_sees_join_event(self):
        async def scenario():
            owner_communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            viewer_communicator, viewer_connection = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=2,
            )

            joined_event = await owner_communicator.receive_json_from()
            self.assertEqual(
                joined_event,
                {
                    'type': 'presence_user_joined',
                    'payload': {
                        'project_id': self.project.pk,
                        'user': {
                            'user_id': self.viewer.pk,
                            'display_name': self.viewer.display_name,
                            'email': self.viewer.email,
                            'avatar_url': self.viewer.avatar_url,
                            'avatar_initial': (self.viewer.display_name or self.viewer.email)[:1].upper(),
                            'role': ProjectMember.Role.VIEWER,
                            'current_frame_id': self.frame_one.pk,
                            'current_frame_index': self.frame_one.index,
                        },
                    },
                },
            )
            self.assertEqual(len(viewer_connection['presence_snapshot']['payload']['users']), 2)

            await viewer_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_disconnect_deactivates_presence_and_emits_leave_event(self):
        async def scenario():
            owner_communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await viewer_communicator.disconnect()

            left_event = await owner_communicator.receive_json_from()
            self.assertEqual(
                left_event,
                {
                    'type': 'presence_user_left',
                    'payload': {
                        'project_id': self.project.pk,
                        'user_id': self.viewer.pk,
                    },
                },
            )

            presence_row = await database_sync_to_async(self._latest_presence_row)(self.viewer.pk)
            self.assertIsNotNone(presence_row)
            self.assertFalse(presence_row.is_active)
            self.assertEqual(
                await database_sync_to_async(self._active_presence_count)(self.viewer.pk),
                0,
            )

            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_frame_change_updates_presence_and_broadcasts_event(self):
        async def scenario():
            owner_communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await viewer_communicator.send_json_to({
                'type': 'presence_set_frame',
                'payload': {
                    'frame_id': self.frame_two.pk,
                },
            })

            viewer_event = await viewer_communicator.receive_json_from()
            owner_event = await owner_communicator.receive_json_from()
            expected_event = {
                'type': 'presence_frame_changed',
                'payload': {
                    'project_id': self.project.pk,
                    'user': {
                        'user_id': self.viewer.pk,
                        'display_name': self.viewer.display_name,
                        'email': self.viewer.email,
                        'avatar_url': self.viewer.avatar_url,
                        'avatar_initial': (self.viewer.display_name or self.viewer.email)[:1].upper(),
                        'role': ProjectMember.Role.VIEWER,
                        'current_frame_id': self.frame_two.pk,
                        'current_frame_index': self.frame_two.index,
                    },
                },
            }
            self.assertEqual(viewer_event, expected_event)
            self.assertEqual(owner_event, expected_event)

            presence_row = await database_sync_to_async(self._latest_presence_row)(self.viewer.pk)
            self.assertIsNotNone(presence_row)
            self.assertEqual(presence_row.current_frame_id, self.frame_two.pk)

            await viewer_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_stale_presence_session_is_ignored_on_snapshot(self):
        stale_time = timezone.now() - timedelta(minutes=5)
        stale_presence = ProjectPresenceSession.objects.create(
            project=self.project,
            user=self.owner,
            channel_name='stale-owner-channel',
            current_frame=self.frame_one,
            role=ProjectMember.Role.OWNER,
            last_seen_at=stale_time,
            is_active=True,
        )

        async def scenario():
            communicator, connection = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=1,
            )
            self.assertEqual(
                [user['user_id'] for user in connection['presence_snapshot']['payload']['users']],
                [self.viewer.pk],
            )
            await communicator.disconnect()

        async_to_sync(scenario)()

        stale_presence.refresh_from_db()
        self.assertFalse(stale_presence.is_active)

    def test_reconnect_receives_fresh_presence_and_lock_snapshots(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, editor_connection = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await editor_communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })
            editor_lock_event = await editor_communicator.receive_json_from()
            owner_lock_event = await owner_communicator.receive_json_from()
            self.assertEqual(editor_lock_event['type'], 'frame_lock_acquired')
            self.assertEqual(owner_lock_event['type'], 'frame_lock_acquired')

            viewer_communicator, first_connection = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=3,
                expected_lock_count=1,
            )
            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()
            await viewer_communicator.disconnect()

            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()

            reconnected_viewer, second_connection = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=3,
                expected_lock_count=1,
            )
            self.assertNotEqual(
                first_connection['presence_session_id'],
                second_connection['presence_session_id'],
            )
            self.assertEqual(
                second_connection['lock_snapshot']['payload']['locks'][0]['frame_id'],
                self.frame_one.pk,
            )
            self.assertEqual(
                second_connection['lock_snapshot']['payload']['locks'][0]['user_id'],
                self.editor.pk,
            )

            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()
            await reconnected_viewer.disconnect()
            await owner_communicator.disconnect()
            await editor_communicator.disconnect()

        async_to_sync(scenario)()

    def test_editor_can_acquire_frame_lock(self):
        async def scenario():
            communicator, connection = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
            )
            presence_session_id = connection['presence_session_id']

            await communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })

            event = await communicator.receive_json_from()
            self.assertEqual(event['type'], 'frame_lock_acquired')
            self.assertEqual(event['payload']['project_id'], self.project.pk)
            lock = event['payload']['lock']
            self.assertEqual(lock['frame_id'], self.frame_one.pk)
            self.assertEqual(lock['frame_index'], self.frame_one.index)
            self.assertEqual(lock['user_id'], self.editor.pk)
            self.assertEqual(lock['role'], ProjectMember.Role.EDITOR)
            self.assertEqual(lock['presence_session_id'], presence_session_id)
            self.assertTrue(lock['expires_at'])

            lock_row = await database_sync_to_async(self._frame_lock_row)(self.frame_one.pk)
            self.assertIsNotNone(lock_row)
            self.assertEqual(lock_row.user_id, self.editor.pk)
            self.assertEqual(lock_row.presence_session_id, presence_session_id)

            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_viewer_cannot_acquire_frame_lock(self):
        async def scenario():
            communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
            )

            await communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })

            event = await communicator.receive_json_from()
            self.assertEqual(
                event,
                {
                    'type': 'frame_lock_denied',
                    'payload': {
                        'project_id': self.project.pk,
                        'frame_id': self.frame_one.pk,
                        'reason': 'read_only_role',
                        'lock': None,
                    },
                },
            )
            self.assertIsNone(await database_sync_to_async(self._frame_lock_row)(self.frame_one.pk))

            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_second_editor_denied_while_lock_active(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })

            owner_acquired = await owner_communicator.receive_json_from()
            editor_seen = await editor_communicator.receive_json_from()
            self.assertEqual(owner_acquired['type'], 'frame_lock_acquired')
            self.assertEqual(editor_seen['type'], 'frame_lock_acquired')
            self.assertEqual(owner_acquired['payload']['lock']['presence_session_id'], owner_connection['presence_session_id'])

            await editor_communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })

            denied = await editor_communicator.receive_json_from()
            self.assertEqual(denied['type'], 'frame_lock_denied')
            self.assertEqual(denied['payload']['reason'], 'locked_by_other')
            self.assertEqual(denied['payload']['lock']['user_id'], self.owner.pk)
            self.assertEqual(denied['payload']['lock']['frame_id'], self.frame_one.pk)

            lock_row = await database_sync_to_async(self._frame_lock_row)(self.frame_one.pk)
            self.assertIsNotNone(lock_row)
            self.assertEqual(lock_row.user_id, self.owner.pk)

            await editor_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_lock_released_on_disconnect(self):
        async def scenario():
            owner_communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()

            await owner_communicator.disconnect()

            released = await editor_communicator.receive_json_from()
            self.assertEqual(released['type'], 'frame_lock_released')
            self.assertEqual(released['payload']['lock']['frame_id'], self.frame_one.pk)
            self.assertIsNone(await database_sync_to_async(self._frame_lock_row)(self.frame_one.pk))

            await editor_communicator.disconnect()

        async_to_sync(scenario)()

    def test_lock_released_on_frame_switch(self):
        async def scenario():
            communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
            )

            await communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })
            await communicator.receive_json_from()

            await communicator.send_json_to({
                'type': 'frame_lock_release',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })
            released = await communicator.receive_json_from()
            self.assertEqual(released['type'], 'frame_lock_released')
            self.assertEqual(released['payload']['lock']['frame_id'], self.frame_one.pk)

            await communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_two.pk,
                },
            })
            acquired = await communicator.receive_json_from()
            self.assertEqual(acquired['type'], 'frame_lock_acquired')
            self.assertEqual(acquired['payload']['lock']['frame_id'], self.frame_two.pk)
            self.assertIsNone(await database_sync_to_async(self._frame_lock_row)(self.frame_one.pk))
            self.assertIsNotNone(await database_sync_to_async(self._frame_lock_row)(self.frame_two.pk))

            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_expired_lock_can_be_replaced(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, editor_connection = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            owner_presence = await database_sync_to_async(self._latest_presence_row)(self.owner.pk)
            self.assertIsNotNone(owner_presence)

            await database_sync_to_async(FrameLock.objects.create)(
                project=self.project,
                frame=self.frame_one,
                user=self.owner,
                presence_session=owner_presence,
                last_heartbeat_at=timezone.now() - timedelta(minutes=2),
                expires_at=timezone.now() - timedelta(seconds=1),
            )

            await editor_communicator.send_json_to({
                'type': 'frame_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                },
            })

            editor_stale_release = await editor_communicator.receive_json_from()
            owner_stale_release = await owner_communicator.receive_json_from()
            self.assertEqual(editor_stale_release['type'], 'frame_lock_released')
            self.assertEqual(owner_stale_release['type'], 'frame_lock_released')
            self.assertEqual(editor_stale_release['payload']['lock']['frame_id'], self.frame_one.pk)
            self.assertEqual(owner_stale_release['payload']['lock']['frame_id'], self.frame_one.pk)

            editor_acquired = await editor_communicator.receive_json_from()
            owner_seen = await owner_communicator.receive_json_from()
            self.assertEqual(editor_acquired['type'], 'frame_lock_acquired')
            self.assertEqual(owner_seen['type'], 'frame_lock_acquired')
            self.assertEqual(
                editor_acquired['payload']['lock']['presence_session_id'],
                editor_connection['presence_session_id'],
            )

            lock_row = await database_sync_to_async(self._frame_lock_row)(self.frame_one.pk)
            self.assertIsNotNone(lock_row)
            self.assertEqual(lock_row.user_id, self.editor.pk)

            await editor_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_frame_create_broadcasts_to_other_client(self):
        async def scenario():
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
            )
            client_request_id = 'frame-create-test'

            response = await sync_to_async(self.owner_client.post)(
                reverse('animation:frame_create', kwargs={'pk': self.project.pk}),
                data=json.dumps({'client_request_id': client_request_id}),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 200)

            event = await viewer_communicator.receive_json_from()
            self.assertEqual(event['type'], 'frame_created')
            self.assertEqual(event['payload']['project_id'], self.project.pk)
            self.assertEqual(event['payload']['actor_user_id'], self.owner.pk)
            self.assertEqual(event['payload']['client_request_id'], client_request_id)
            self.assertEqual(event['payload']['active_index'], 3)
            self.assertEqual(len(event['payload']['frames']), 3)

            await viewer_communicator.disconnect()

        async_to_sync(scenario)()

    def test_frame_delete_broadcasts_to_other_client(self):
        async def scenario():
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
            )
            client_request_id = 'frame-delete-test'

            response = await sync_to_async(self.owner_client.post)(
                reverse('animation:frame_delete', kwargs={'pk': self.project.pk, 'index': self.frame_two.index}),
                data=json.dumps({'client_request_id': client_request_id}),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 200)

            event = await viewer_communicator.receive_json_from()
            self.assertEqual(event['type'], 'frame_deleted')
            self.assertEqual(event['payload']['frame_id'], self.frame_two.pk)
            self.assertEqual(event['payload']['deleted_frame_index'], self.frame_two.index)
            self.assertEqual(event['payload']['actor_user_id'], self.owner.pk)
            self.assertEqual(event['payload']['client_request_id'], client_request_id)
            self.assertEqual(len(event['payload']['frames']), 1)

            await viewer_communicator.disconnect()

        async_to_sync(scenario)()

    def test_frame_reorder_broadcasts_to_other_client(self):
        async def scenario():
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
            )
            client_request_id = 'frame-reorder-test'

            response = await sync_to_async(self.owner_client.post)(
                reverse('animation:frame_reorder', kwargs={'pk': self.project.pk}),
                data=json.dumps({
                    'ordered_ids': [self.frame_two.pk, self.frame_one.pk],
                    'client_request_id': client_request_id,
                }),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 200)

            event = await viewer_communicator.receive_json_from()
            self.assertEqual(event['type'], 'frame_reordered')
            self.assertEqual(event['payload']['actor_user_id'], self.owner.pk)
            self.assertEqual(event['payload']['client_request_id'], client_request_id)
            self.assertEqual(
                [frame['id'] for frame in event['payload']['frames']],
                [self.frame_two.pk, self.frame_one.pk],
            )

            await viewer_communicator.disconnect()

        async_to_sync(scenario)()

    def test_layer_rename_broadcasts_to_other_client(self):
        async def scenario():
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
            )
            client_request_id = 'layer-rename-test'

            response = await sync_to_async(self.owner_client.post)(
                reverse(
                    'animation:layer_update',
                    kwargs={'pk': self.project.pk, 'index': self.frame_one.index, 'layer_id': self.layer_one.pk},
                ),
                data=json.dumps({
                    'name': 'Foreground',
                    'client_request_id': client_request_id,
                }),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 200)

            event = await viewer_communicator.receive_json_from()
            self.assertEqual(event['type'], 'layer_renamed')
            self.assertEqual(event['payload']['frame_id'], self.frame_one.pk)
            self.assertEqual(event['payload']['layer_id'], self.layer_one.pk)
            self.assertEqual(event['payload']['layer']['name'], 'Foreground')
            self.assertEqual(event['payload']['actor_user_id'], self.owner.pk)
            self.assertEqual(event['payload']['client_request_id'], client_request_id)

            await viewer_communicator.disconnect()

        async_to_sync(scenario)()

    def test_layer_visibility_broadcasts_to_other_client(self):
        async def scenario():
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
            )
            client_request_id = 'layer-visibility-test'

            response = await sync_to_async(self.owner_client.post)(
                reverse(
                    'animation:layer_update',
                    kwargs={'pk': self.project.pk, 'index': self.frame_one.index, 'layer_id': self.layer_one.pk},
                ),
                data=json.dumps({
                    'visible': False,
                    'client_request_id': client_request_id,
                }),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 200)

            event = await viewer_communicator.receive_json_from()
            self.assertEqual(event['type'], 'layer_visibility_changed')
            self.assertEqual(event['payload']['frame_id'], self.frame_one.pk)
            self.assertEqual(event['payload']['layer_id'], self.layer_one.pk)
            self.assertFalse(event['payload']['layer']['visible'])
            self.assertEqual(event['payload']['actor_user_id'], self.owner.pk)
            self.assertEqual(event['payload']['client_request_id'], client_request_id)

            await viewer_communicator.disconnect()

        async_to_sync(scenario)()

    def test_editors_can_lock_different_layers_on_same_frame(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, editor_connection = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            owner_acquired = await owner_communicator.receive_json_from()
            editor_seen_owner = await editor_communicator.receive_json_from()
            self.assertEqual(owner_acquired['type'], 'layer_lock_acquired')
            self.assertEqual(editor_seen_owner['type'], 'layer_lock_acquired')
            self.assertEqual(owner_acquired['payload']['lock']['layer_id'], self.layer_one.pk)
            self.assertEqual(owner_acquired['payload']['lock']['presence_session_id'], owner_connection['presence_session_id'])

            await editor_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_two.pk,
                },
            })
            editor_acquired = await editor_communicator.receive_json_from()
            owner_seen_editor = await owner_communicator.receive_json_from()
            self.assertEqual(editor_acquired['type'], 'layer_lock_acquired')
            self.assertEqual(owner_seen_editor['type'], 'layer_lock_acquired')
            self.assertEqual(editor_acquired['payload']['lock']['layer_id'], self.layer_two.pk)
            self.assertEqual(editor_acquired['payload']['lock']['presence_session_id'], editor_connection['presence_session_id'])

            owner_lock = await database_sync_to_async(self._layer_lock_row)(self.layer_one.pk)
            editor_lock = await database_sync_to_async(self._layer_lock_row)(self.layer_two.pk)
            self.assertIsNotNone(owner_lock)
            self.assertIsNotNone(editor_lock)
            self.assertEqual(owner_lock.user_id, self.owner.pk)
            self.assertEqual(editor_lock.user_id, self.editor.pk)

            await editor_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_same_session_switching_layers_releases_previous_lock(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await viewer_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_two.pk,
                },
            })

            owner_released = await owner_communicator.receive_json_from()
            viewer_released = await viewer_communicator.receive_json_from()
            self.assertEqual(owner_released['type'], 'layer_lock_released')
            self.assertEqual(viewer_released['type'], 'layer_lock_released')
            self.assertEqual(owner_released['payload']['lock']['layer_id'], self.layer_one.pk)
            self.assertEqual(viewer_released['payload']['lock']['layer_id'], self.layer_one.pk)

            owner_acquired = await owner_communicator.receive_json_from()
            viewer_acquired = await viewer_communicator.receive_json_from()
            self.assertEqual(owner_acquired['type'], 'layer_lock_acquired')
            self.assertEqual(viewer_acquired['type'], 'layer_lock_acquired')
            self.assertEqual(owner_acquired['payload']['lock']['layer_id'], self.layer_two.pk)
            self.assertEqual(viewer_acquired['payload']['lock']['layer_id'], self.layer_two.pk)
            self.assertEqual(
                owner_acquired['payload']['lock']['presence_session_id'],
                owner_connection['presence_session_id'],
            )

            self.assertIsNone(await database_sync_to_async(self._layer_lock_row)(self.layer_one.pk))
            remaining_lock = await database_sync_to_async(self._layer_lock_row)(self.layer_two.pk)
            self.assertIsNotNone(remaining_lock)
            self.assertEqual(remaining_lock.presence_session_id, owner_connection['presence_session_id'])

            await viewer_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_viewer_cannot_acquire_layer_lock(self):
        async def scenario():
            communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
            )

            await communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })

            event = await communicator.receive_json_from()
            self.assertEqual(event['type'], 'layer_lock_denied')
            self.assertEqual(event['payload']['reason'], 'read_only_role')
            self.assertIsNone(await database_sync_to_async(self._layer_lock_row)(self.layer_one.pk))

            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_second_editor_denied_when_layer_lock_is_active(self):
        async def scenario():
            owner_communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()

            await editor_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            denied = await editor_communicator.receive_json_from()
            self.assertEqual(denied['type'], 'layer_lock_denied')
            self.assertEqual(denied['payload']['reason'], 'locked_by_other')
            self.assertEqual(denied['payload']['lock']['layer_id'], self.layer_one.pk)
            self.assertEqual(denied['payload']['lock']['user_id'], self.owner.pk)

            await editor_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_layer_lock_released_on_disconnect(self):
        async def scenario():
            owner_communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()

            await owner_communicator.disconnect()

            released = await editor_communicator.receive_json_from()
            self.assertEqual(released['type'], 'layer_lock_released')
            self.assertEqual(released['payload']['lock']['layer_id'], self.layer_one.pk)
            self.assertIsNone(await database_sync_to_async(self._layer_lock_row)(self.layer_one.pk))

            await editor_communicator.disconnect()

        async_to_sync(scenario)()

    def test_frame_change_releases_owned_layer_locks(self):
        async def scenario():
            owner_communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await viewer_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'presence_set_frame',
                'payload': {
                    'frame_id': self.frame_two.pk,
                },
            })

            owner_released = await owner_communicator.receive_json_from()
            viewer_released = await viewer_communicator.receive_json_from()
            self.assertEqual(owner_released['type'], 'layer_lock_released')
            self.assertEqual(viewer_released['type'], 'layer_lock_released')
            self.assertEqual(owner_released['payload']['lock']['layer_id'], self.layer_one.pk)
            self.assertEqual(viewer_released['payload']['lock']['layer_id'], self.layer_one.pk)

            owner_presence_event = await owner_communicator.receive_json_from()
            viewer_presence_event = await viewer_communicator.receive_json_from()
            self.assertEqual(owner_presence_event['type'], 'presence_frame_changed')
            self.assertEqual(viewer_presence_event['type'], 'presence_frame_changed')
            self.assertEqual(owner_presence_event['payload']['user']['current_frame_id'], self.frame_two.pk)
            self.assertEqual(viewer_presence_event['payload']['user']['current_frame_id'], self.frame_two.pk)

            self.assertIsNone(await database_sync_to_async(self._layer_lock_row)(self.layer_one.pk))

            await viewer_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_expired_layer_lock_can_be_replaced(self):
        async def scenario():
            owner_communicator, _ = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, editor_connection = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            owner_presence = await database_sync_to_async(self._latest_presence_row)(self.owner.pk)
            await database_sync_to_async(LayerLock.objects.create)(
                project=self.project,
                frame=self.frame_one,
                layer=self.layer_one,
                user=self.owner,
                presence_session=owner_presence,
                last_heartbeat_at=timezone.now() - timedelta(minutes=2),
                expires_at=timezone.now() - timedelta(seconds=1),
            )

            await editor_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })

            stale_release_editor = await editor_communicator.receive_json_from()
            stale_release_owner = await owner_communicator.receive_json_from()
            self.assertEqual(stale_release_editor['type'], 'layer_lock_released')
            self.assertEqual(stale_release_owner['type'], 'layer_lock_released')
            self.assertEqual(stale_release_editor['payload']['lock']['layer_id'], self.layer_one.pk)

            editor_acquired = await editor_communicator.receive_json_from()
            owner_seen = await owner_communicator.receive_json_from()
            self.assertEqual(editor_acquired['type'], 'layer_lock_acquired')
            self.assertEqual(owner_seen['type'], 'layer_lock_acquired')
            self.assertEqual(
                editor_acquired['payload']['lock']['presence_session_id'],
                editor_connection['presence_session_id'],
            )

            lock_row = await database_sync_to_async(self._layer_lock_row)(self.layer_one.pk)
            self.assertIsNotNone(lock_row)
            self.assertEqual(lock_row.user_id, self.editor.pk)

            await editor_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_live_stroke_events_broadcast_to_other_editor(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_begin',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'brush',
                    'color': '#112233',
                    'size': 6,
                    'opacity': 0.8,
                    'blur': 0,
                    'seq': 1,
                    'stroke_id': 'stroke-1',
                    'base_revision': 0,
                    'x': 10,
                    'y': 12,
                },
            })
            begin_event = await editor_communicator.receive_json_from()
            self.assertEqual(begin_event['type'], 'layer_stroke_begin')
            self.assertEqual(begin_event['payload']['layer_id'], self.layer_one.pk)
            self.assertEqual(begin_event['payload']['presence_session_id'], owner_connection['presence_session_id'])
            self.assertEqual(begin_event['payload']['stroke_id'], 'stroke-1')
            self.assertEqual(begin_event['payload']['avatar_url'], self.owner.avatar_url)
            self.assertEqual(begin_event['payload']['avatar_initial'], (self.owner.display_name or self.owner.email)[:1].upper())

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_segment',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'brush',
                    'color': '#112233',
                    'size': 6,
                    'opacity': 0.8,
                    'blur': 0,
                    'seq': 2,
                    'stroke_id': 'stroke-1',
                    'base_revision': 0,
                    'x1': 10,
                    'y1': 12,
                    'x2': 32,
                    'y2': 40,
                },
            })
            segment_event = await editor_communicator.receive_json_from()
            self.assertEqual(segment_event['type'], 'layer_stroke_segment')
            self.assertEqual(segment_event['payload']['user_id'], self.owner.pk)
            self.assertEqual(segment_event['payload']['presence_session_id'], owner_connection['presence_session_id'])
            self.assertEqual(segment_event['payload']['stroke_id'], 'stroke-1')

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_end',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'brush',
                    'seq': 3,
                    'stroke_id': 'stroke-1',
                    'base_revision': 0,
                    'x': 32,
                    'y': 40,
                },
            })
            end_event = await editor_communicator.receive_json_from()
            self.assertEqual(end_event['type'], 'layer_stroke_end')
            self.assertEqual(end_event['payload']['layer_id'], self.layer_one.pk)
            self.assertEqual(end_event['payload']['stroke_id'], 'stroke-1')

            await editor_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_live_stroke_sequence_can_restart_for_new_stroke_id_without_save(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_begin',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'brush',
                    'color': '#112233',
                    'size': 6,
                    'opacity': 0.8,
                    'blur': 0,
                    'seq': 1,
                    'stroke_id': 'stroke-1',
                    'base_revision': 0,
                    'x': 10,
                    'y': 12,
                },
            })
            first_begin = await editor_communicator.receive_json_from()
            self.assertEqual(first_begin['payload']['seq'], 1)
            self.assertEqual(first_begin['payload']['stroke_id'], 'stroke-1')
            self.assertEqual(first_begin['payload']['presence_session_id'], owner_connection['presence_session_id'])

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_end',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'brush',
                    'seq': 2,
                    'stroke_id': 'stroke-1',
                    'base_revision': 0,
                    'x': 12,
                    'y': 14,
                },
            })
            first_end = await editor_communicator.receive_json_from()
            self.assertEqual(first_end['payload']['seq'], 2)
            self.assertEqual(first_end['payload']['stroke_id'], 'stroke-1')

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_begin',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'brush',
                    'color': '#112233',
                    'size': 6,
                    'opacity': 0.8,
                    'blur': 0,
                    'seq': 1,
                    'stroke_id': 'stroke-2',
                    'base_revision': 0,
                    'x': 20,
                    'y': 24,
                },
            })
            second_begin = await editor_communicator.receive_json_from()
            self.assertEqual(second_begin['type'], 'layer_stroke_begin')
            self.assertEqual(second_begin['payload']['seq'], 1)
            self.assertEqual(second_begin['payload']['stroke_id'], 'stroke-2')
            self.assertEqual(second_begin['payload']['presence_session_id'], owner_connection['presence_session_id'])

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_segment',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'brush',
                    'color': '#112233',
                    'size': 6,
                    'opacity': 0.8,
                    'blur': 0,
                    'seq': 2,
                    'stroke_id': 'stroke-2',
                    'base_revision': 0,
                    'x1': 20,
                    'y1': 24,
                    'x2': 30,
                    'y2': 36,
                },
            })
            second_segment = await editor_communicator.receive_json_from()
            self.assertEqual(second_segment['type'], 'layer_stroke_segment')
            self.assertEqual(second_segment['payload']['seq'], 2)
            self.assertEqual(second_segment['payload']['stroke_id'], 'stroke-2')

            await editor_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_live_eraser_stroke_events_broadcast_to_other_editor(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            editor_communicator, _ = await self._assert_member_can_connect(
                self.editor,
                ProjectMember.Role.EDITOR,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await editor_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_begin',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'eraser',
                    'size': 10,
                    'opacity': 1,
                    'blur': 0,
                    'seq': 1,
                    'base_revision': 0,
                    'x': 18,
                    'y': 20,
                },
            })
            begin_event = await editor_communicator.receive_json_from()
            self.assertEqual(begin_event['type'], 'layer_stroke_begin')
            self.assertEqual(begin_event['payload']['tool'], 'eraser')
            self.assertEqual(begin_event['payload']['seq'], 1)
            self.assertEqual(begin_event['payload']['presence_session_id'], owner_connection['presence_session_id'])

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_segment',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'eraser',
                    'size': 10,
                    'opacity': 1,
                    'blur': 0,
                    'seq': 2,
                    'base_revision': 0,
                    'x1': 18,
                    'y1': 20,
                    'x2': 42,
                    'y2': 44,
                },
            })
            segment_event = await editor_communicator.receive_json_from()
            self.assertEqual(segment_event['type'], 'layer_stroke_segment')
            self.assertEqual(segment_event['payload']['tool'], 'eraser')
            self.assertEqual(segment_event['payload']['seq'], 2)
            self.assertEqual(segment_event['payload']['user_id'], self.owner.pk)

            await owner_communicator.send_json_to({
                'type': 'layer_stroke_end',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                    'tool': 'eraser',
                    'seq': 3,
                    'base_revision': 0,
                    'x': 42,
                    'y': 44,
                },
            })
            end_event = await editor_communicator.receive_json_from()
            self.assertEqual(end_event['type'], 'layer_stroke_end')
            self.assertEqual(end_event['payload']['tool'], 'eraser')
            self.assertEqual(end_event['payload']['seq'], 3)

            await editor_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()

    def test_frame_save_broadcasts_committed_updates_to_other_client(self):
        async def scenario():
            owner_communicator, owner_connection = await self._assert_member_can_connect(
                self.owner,
                ProjectMember.Role.OWNER,
            )
            viewer_communicator, _ = await self._assert_member_can_connect(
                self.viewer,
                ProjectMember.Role.VIEWER,
                expected_user_count=2,
            )
            await owner_communicator.receive_json_from()

            await owner_communicator.send_json_to({
                'type': 'layer_lock_acquire',
                'payload': {
                    'frame_id': self.frame_one.pk,
                    'layer_id': self.layer_one.pk,
                },
            })
            await owner_communicator.receive_json_from()
            await viewer_communicator.receive_json_from()

            response = await sync_to_async(self.owner_client.post)(
                reverse('animation:frame_save', kwargs={'pk': self.project.pk, 'index': self.frame_one.index}),
                data=json.dumps({
                    'content_json': {
                        'version': 1,
                        'active_layer_id': self.layer_one.pk,
                        'layers': [{'id': self.layer_one.pk, 'image_data': 'data:image/png;base64,AAAA'}],
                    },
                    'active_layer_id': self.layer_one.pk,
                    'active_layer_revision': 0,
                    'presence_session_id': owner_connection['presence_session_id'],
                    'client_request_id': 'ws-frame-save',
                }),
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 200)

            frame_event = await viewer_communicator.receive_json_from()
            layer_event = await viewer_communicator.receive_json_from()
            self.assertEqual(frame_event['type'], 'frame_content_updated')
            self.assertEqual(frame_event['payload']['frame_id'], self.frame_one.pk)
            self.assertEqual(frame_event['payload']['client_request_id'], 'ws-frame-save')
            self.assertEqual(frame_event['payload']['frame_content_revision'], 1)
            self.assertEqual(layer_event['type'], 'layer_content_committed')
            self.assertEqual(layer_event['payload']['layer_id'], self.layer_one.pk)
            self.assertEqual(layer_event['payload']['presence_session_id'], owner_connection['presence_session_id'])
            self.assertEqual(layer_event['payload']['frame_content_revision'], 1)
            self.assertEqual(layer_event['payload']['layer_content_revision'], 1)

            await viewer_communicator.disconnect()
            await owner_communicator.disconnect()

        async_to_sync(scenario)()


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


class FrameRealtimeSyncTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='realtime-sync@example.com', password='test')
        self.project = AnimationProject.objects.create(
            owner=self.user,
            title='Realtime sync project',
            width=512,
            height=512,
            fps=12,
        )
        self.frame = Frame.objects.create(project=self.project, index=1, content_json='{"layers":[]}')
        self.layer = Layer.objects.create(frame=self.frame, order=1, name='Ink', visible=True, opacity=100)
        self.client = Client()
        self.client.force_login(self.user)

    def _lock_active_layer(self, *, user=None, layer=None, role=ProjectMember.Role.OWNER, frame=None):
        user = user or self.user
        layer = layer or self.layer
        frame = frame or self.frame
        now = timezone.now()
        presence_session = ProjectPresenceSession.objects.create(
            project=self.project,
            user=user,
            channel_name=f'test-layer-lock-{user.pk}-{layer.pk}-{ProjectPresenceSession.objects.count() + 1}',
            current_frame=frame,
            role=role,
            last_seen_at=now,
            is_active=True,
        )
        LayerLock.objects.create(
            project=self.project,
            frame=frame,
            layer=layer,
            user=user,
            presence_session=presence_session,
            last_heartbeat_at=now,
            expires_at=now + timedelta(seconds=30),
        )
        return presence_session

    def test_frame_save_updates_revisions_with_valid_layer_lock(self):
        presence_session = self._lock_active_layer()
        payload = {
            'content_json': {
                'layers': [{'id': self.layer.pk, 'image_data': 'data:image/png;base64,AAAA'}],
                'active_layer_id': self.layer.pk,
            },
            'active_layer_id': self.layer.pk,
            'active_layer_revision': 0,
            'presence_session_id': presence_session.pk,
            'client_request_id': 'frame-save-request',
        }

        response = self.client.post(
            reverse('animation:frame_save', kwargs={'pk': self.project.pk, 'index': self.frame.index}),
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        response_payload = response.json()
        self.assertTrue(response_payload['ok'])
        self.assertEqual(response_payload['frame']['content_revision'], 1)
        self.assertEqual(response_payload['layer']['content_revision'], 1)

        self.frame.refresh_from_db()
        self.layer.refresh_from_db()
        self.assertEqual(self.frame.content_revision, 1)
        self.assertEqual(self.layer.content_revision, 1)

    def test_frame_save_requires_layer_lock_for_active_layer(self):
        payload = {
            'content_json': {
                'layers': [{'id': self.layer.pk, 'image_data': 'data:image/png;base64,AAAA'}],
                'active_layer_id': self.layer.pk,
            },
            'active_layer_id': self.layer.pk,
            'active_layer_revision': 0,
        }

        response = self.client.post(
            reverse('animation:frame_save', kwargs={'pk': self.project.pk, 'index': self.frame.index}),
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error'], 'Layer lock required.')

    def test_frame_save_rejects_stale_layer_revision(self):
        presence_session = self._lock_active_layer()
        self.layer.content_revision = 2
        self.layer.save(update_fields=['content_revision'])

        payload = {
            'content_json': {
                'layers': [{'id': self.layer.pk, 'image_data': 'data:image/png;base64,AAAA'}],
                'active_layer_id': self.layer.pk,
            },
            'active_layer_id': self.layer.pk,
            'active_layer_revision': 1,
            'presence_session_id': presence_session.pk,
        }

        response = self.client.post(
            reverse('animation:frame_save', kwargs={'pk': self.project.pk, 'index': self.frame.index}),
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error'], 'Layer content is stale. Refresh the frame and try again.')

    def test_frame_save_merges_active_layer_into_latest_frame_content(self):
        presence_session = self._lock_active_layer()
        second_layer = Layer.objects.create(frame=self.frame, order=2, name='Paint', visible=True, opacity=100)
        self.frame.content_json = json.dumps({
            'version': 1,
            'active_layer_id': second_layer.pk,
            'layers': [
                {'id': self.layer.pk, 'image_data': 'ink-before'},
                {'id': second_layer.pk, 'image_data': 'paint-stays'},
            ],
        })
        self.frame.save(update_fields=['content_json'])

        payload = {
            'content_json': {
                'version': 1,
                'active_layer_id': self.layer.pk,
                'layers': [
                    {'id': self.layer.pk, 'image_data': 'ink-after'},
                    {'id': second_layer.pk, 'image_data': 'paint-ignored-from-client'},
                ],
            },
            'active_layer_id': self.layer.pk,
            'active_layer_revision': 0,
            'presence_session_id': presence_session.pk,
        }

        response = self.client.post(
            reverse('animation:frame_save', kwargs={'pk': self.project.pk, 'index': self.frame.index}),
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        response_payload = response.json()
        self.frame.refresh_from_db()
        saved_payload = json.loads(self.frame.content_json)
        saved_layers = {entry['id']: entry['image_data'] for entry in saved_payload['layers']}
        self.assertEqual(saved_layers[self.layer.pk], 'ink-after')
        self.assertEqual(saved_layers[second_layer.pk], 'paint-stays')

        returned_payload = json.loads(response_payload['frame']['content_json'])
        returned_layers = {entry['id']: entry['image_data'] for entry in returned_payload['layers']}
        self.assertEqual(returned_layers[self.layer.pk], 'ink-after')
        self.assertEqual(returned_layers[second_layer.pk], 'paint-stays')

    def test_sequential_frame_saves_preserve_other_users_layers(self):
        second_user = User.objects.create_user(email='realtime-collaborator@example.com', password='test')
        ProjectMember.objects.create(
            project=self.project,
            user=second_user,
            role=ProjectMember.Role.EDITOR,
            invited_by=self.user,
        )
        second_client = Client()
        second_client.force_login(second_user)
        second_layer = Layer.objects.create(frame=self.frame, order=2, name='Paint', visible=True, opacity=100)
        self.frame.content_json = json.dumps({
            'version': 1,
            'active_layer_id': self.layer.pk,
            'layers': [
                {'id': self.layer.pk, 'image_data': 'ink-before'},
                {'id': second_layer.pk, 'image_data': 'paint-before'},
            ],
        })
        self.frame.save(update_fields=['content_json'])

        owner_presence = self._lock_active_layer()
        editor_presence = self._lock_active_layer(
            user=second_user,
            layer=second_layer,
            role=ProjectMember.Role.EDITOR,
        )

        owner_response = self.client.post(
            reverse('animation:frame_save', kwargs={'pk': self.project.pk, 'index': self.frame.index}),
            data=json.dumps({
                'content_json': {
                    'version': 1,
                    'active_layer_id': self.layer.pk,
                    'layers': [
                        {'id': self.layer.pk, 'image_data': 'ink-after'},
                        {'id': second_layer.pk, 'image_data': 'paint-stale-from-owner'},
                    ],
                },
                'active_layer_id': self.layer.pk,
                'active_layer_revision': 0,
                'presence_session_id': owner_presence.pk,
            }),
            content_type='application/json',
        )
        self.assertEqual(owner_response.status_code, 200)

        self.frame.refresh_from_db()
        after_owner_save = json.loads(self.frame.content_json)
        layers_after_owner_save = {entry['id']: entry['image_data'] for entry in after_owner_save['layers']}
        self.assertEqual(layers_after_owner_save[self.layer.pk], 'ink-after')
        self.assertEqual(layers_after_owner_save[second_layer.pk], 'paint-before')

        editor_response = second_client.post(
            reverse('animation:frame_save', kwargs={'pk': self.project.pk, 'index': self.frame.index}),
            data=json.dumps({
                'content_json': {
                    'version': 1,
                    'active_layer_id': second_layer.pk,
                    'layers': [
                        {'id': self.layer.pk, 'image_data': 'ink-stale-from-editor'},
                        {'id': second_layer.pk, 'image_data': 'paint-after'},
                    ],
                },
                'active_layer_id': second_layer.pk,
                'active_layer_revision': 0,
                'presence_session_id': editor_presence.pk,
            }),
            content_type='application/json',
        )
        self.assertEqual(editor_response.status_code, 200)

        self.frame.refresh_from_db()
        self.layer.refresh_from_db()
        second_layer.refresh_from_db()
        final_payload = json.loads(self.frame.content_json)
        final_layers = {entry['id']: entry['image_data'] for entry in final_payload['layers']}
        self.assertEqual(final_layers[self.layer.pk], 'ink-after')
        self.assertEqual(final_layers[second_layer.pk], 'paint-after')
        self.assertEqual(self.frame.content_revision, 2)
        self.assertEqual(self.layer.content_revision, 1)
        self.assertEqual(second_layer.content_revision, 1)

        returned_payload = json.loads(editor_response.json()['frame']['content_json'])
        returned_layers = {entry['id']: entry['image_data'] for entry in returned_payload['layers']}
        self.assertEqual(returned_layers[self.layer.pk], 'ink-after')
        self.assertEqual(returned_layers[second_layer.pk], 'paint-after')

    def test_project_save_updates_frame_revisions(self):
        second_frame = Frame.objects.create(project=self.project, index=2, content_json='{"layers":[]}')
        payload = {
            'frames': [
                {'index': 1, 'content': {'layers': [{'id': 'layer-1'}]}},
                {'index': 2, 'content': {'layers': [{'id': 'layer-2'}]}},
            ],
            'client_request_id': 'project-save-request',
        }

        response = self.client.post(
            reverse('animation:project_save', kwargs={'pk': self.project.pk}),
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'ok': True, 'saved_frames': [1, 2]})

        self.frame.refresh_from_db()
        second_frame.refresh_from_db()
        self.assertEqual(self.frame.content_revision, 1)
        self.assertEqual(second_frame.content_revision, 1)
