import base64
import io
import json
import mimetypes
import os
import shutil
import subprocess
import tempfile
import zipfile
from binascii import Error as BinasciiError
from email.utils import parseaddr

from django.contrib import messages
from django.conf import settings
from django.core.files.base import ContentFile
from django.core import signing
from django.core.exceptions import RequestDataTooBig
from django.db import transaction
from django.db.models import Max, Prefetch
from django.http import JsonResponse, FileResponse, Http404, HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST, require_http_methods
from .access import (
    get_project_membership,
    get_accessible_project_or_404,
    get_accessible_projects_queryset,
    get_editable_project_or_404,
    get_manageable_project_or_404,
)
from .models import AnimationProject, Frame, Layer, ProjectComment, ProjectMember
from .locks import presence_session_holds_layer_lock
from .realtime import broadcast_project_event

MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024
MAX_EXPORT_GIF_BYTES = 50 * 1024 * 1024
MAX_EXPORT_GIF_FRAMES = 250
MAX_EXPORT_GIF_TOTAL_PIXELS = 200_000_000
MAX_EXPORT_PNG_ZIP_FRAMES = 2000
MAX_EXPORT_VIDEO_BYTES = 250 * 1024 * 1024
MAX_EXPORT_VIDEO_FRAMES = 2000
MAX_EXPORT_VIDEO_TOTAL_PIXELS = 500_000_000
VIDEO_ENCODE_PLAYBACK_FPS = 30
MAX_PROJECT_COMMENT_BODY_LENGTH = 5000
EXPORT_TOKEN_MAX_AGE_SECONDS = 60 * 60  # 1 hour
EXPORT_SIGNING_SALT = 'animstudio.export'
EXPORT_BASE_DIR = 'exports'
FAVICON_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<rect width="64" height="64" rx="14" fill="#111827"/>'
    '<path d="M18 46V18h10l8 15 8-15h10v28h-8V30l-7 13h-6l-7-13v16Z" fill="#f9fafb"/>'
    '</svg>'
)
ROBOTS_TXT = 'User-agent: *\nDisallow:\n'
EMPTY_SITEMAP_XML = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n'
)


def favicon(request):
    return HttpResponse(FAVICON_SVG, content_type='image/svg+xml')


def robots_txt(request):
    return HttpResponse(ROBOTS_TXT, content_type='text/plain; charset=utf-8')


def security_txt(request):
    _, contact_email = parseaddr(getattr(settings, 'DEFAULT_FROM_EMAIL', ''))
    if not contact_email:
        contact_email = 'security@animstudio.local'
    body = '\n'.join([
        f'Contact: mailto:{contact_email}',
        f'Canonical: {request.build_absolute_uri("/.well-known/security.txt")}',
        '',
    ])
    return HttpResponse(body, content_type='text/plain; charset=utf-8')


def sitemap_xml(request):
    return HttpResponse(EMPTY_SITEMAP_XML, content_type='application/xml; charset=utf-8')


def serialize_layer(layer):
    return {
        'id': layer.pk,
        'order': layer.order,
        'name': layer.name,
        'visible': layer.visible,
        'opacity': layer.opacity,
        'content_revision': layer.content_revision,
    }


def normalize_client_request_id(value):
    if not isinstance(value, str):
        return ''
    return value.strip()[:128]


def serialize_frame(frame):
    preview_url = ''
    if frame.preview_image:
        try:
            preview_url = frame.preview_image.url
        except Exception:
            preview_url = ''
    return {
        'id': frame.pk,
        'index': frame.index,
        'preview_url': preview_url,
        'updated_at': frame.updated_at.isoformat() if frame.updated_at else '',
        'content_revision': frame.content_revision,
        'has_preview': bool(preview_url),
    }


def serialize_project_comment(comment, current_user=None, membership=None):
    author = comment.author
    frame = comment.frame
    can_delete = False
    can_resolve = False
    if current_user and getattr(current_user, 'is_authenticated', False):
        can_delete = comment.author_id == current_user.pk or (
            membership is not None and membership.can_manage_members()
        )
        can_resolve = membership is not None and membership.can_edit()

    resolved_by = comment.resolved_by
    return {
        'id': comment.pk,
        'project_id': comment.project_id,
        'frame_id': comment.frame_id,
        'frame_index': frame.index if frame is not None else None,
        'body': comment.body,
        'created_at': comment.created_at.isoformat() if comment.created_at else '',
        'updated_at': comment.updated_at.isoformat() if comment.updated_at else '',
        'is_resolved': comment.is_resolved,
        'resolved_at': comment.resolved_at.isoformat() if comment.resolved_at else '',
        'resolved_by': {
            'id': resolved_by.pk,
            'display_name': resolved_by.display_name or resolved_by.email,
        } if resolved_by is not None else None,
        'author': {
            'id': author.pk,
            'display_name': author.display_name or author.email,
            'email': author.email,
            'avatar_url': author.avatar_url,
        },
        'can_delete': can_delete,
        'can_resolve': can_resolve,
    }


def build_frame_preview_payload(frame):
    frame_payload = serialize_frame(frame)
    return {
        'frame_id': frame.pk,
        'frame_index': frame.index,
        'frame_content_revision': frame.content_revision,
        'preview_url': frame_payload['preview_url'],
        'updated_at': frame_payload['updated_at'],
        'has_preview': frame_payload['has_preview'],
    }


def build_frame_save_response_payload(frame, active_layer=None, needs_authoritative_refresh=False):
    return {
        'ok': True,
        **build_frame_preview_payload(frame),
        'frame_revision': frame.content_revision,
        'active_layer_id': active_layer.pk if active_layer is not None else None,
        'active_layer_revision': active_layer.content_revision if active_layer is not None else None,
        'needs_authoritative_refresh': bool(needs_authoritative_refresh),
    }


def build_frame_content_updated_payload(frame, actor_user_id, client_request_id=''):
    return {
        **build_frame_preview_payload(frame),
        'actor_user_id': actor_user_id,
        'client_request_id': client_request_id,
    }


def build_layer_content_committed_payload(frame, layer, actor_user_id, client_request_id='', presence_session_id=None):
    return {
        **build_frame_preview_payload(frame),
        'layer_id': layer.pk,
        'layer_name': layer.name,
        'layer_content_revision': layer.content_revision,
        'actor_user_id': actor_user_id,
        'client_request_id': client_request_id,
        'presence_session_id': presence_session_id,
    }


def _parse_frame_content_payload(raw_content):
    if isinstance(raw_content, dict):
        payload = raw_content
    elif isinstance(raw_content, str):
        try:
            payload = json.loads(raw_content)
        except json.JSONDecodeError:
            return None
    else:
        return None
    if not isinstance(payload, dict) or not isinstance(payload.get('layers'), list):
        return None
    return payload


def _serialize_frame_content_payload(payload):
    return json.dumps(payload, ensure_ascii=False)


def _normalize_frame_content_payload(raw_content):
    parsed_payload = _parse_frame_content_payload(raw_content)
    if parsed_payload is not None:
        return _serialize_frame_content_payload(parsed_payload)
    if isinstance(raw_content, str):
        return raw_content
    return _serialize_frame_content_payload(raw_content)


def _merge_active_layer_content(existing_raw, incoming_raw, active_layer_id):
    incoming_payload = _parse_frame_content_payload(incoming_raw)
    if incoming_payload is None:
        return incoming_raw if isinstance(incoming_raw, str) else _serialize_frame_content_payload(incoming_raw)
    if not active_layer_id:
        return _serialize_frame_content_payload(incoming_payload)

    existing_payload = _parse_frame_content_payload(existing_raw)
    if existing_payload is None:
        return _serialize_frame_content_payload(incoming_payload)

    try:
        numeric_layer_id = int(active_layer_id)
    except (TypeError, ValueError):
        return _serialize_frame_content_payload(incoming_payload)

    incoming_layer_entry = None
    for layer_entry in incoming_payload.get('layers', []):
        try:
            entry_layer_id = int(layer_entry.get('id'))
        except (TypeError, ValueError, AttributeError):
            continue
        if entry_layer_id == numeric_layer_id:
            incoming_layer_entry = layer_entry
            break

    if incoming_layer_entry is None:
        return _serialize_frame_content_payload(incoming_payload)

    merged_payload = {
        **existing_payload,
        'version': incoming_payload.get('version', existing_payload.get('version', 1)),
        'width': incoming_payload.get('width', existing_payload.get('width')),
        'height': incoming_payload.get('height', existing_payload.get('height')),
        'active_layer_id': incoming_payload.get('active_layer_id'),
        'active_layer_order': incoming_payload.get('active_layer_order'),
        'active_layer_index': incoming_payload.get('active_layer_index'),
    }

    merged_layers = []
    replaced = False
    for layer_entry in existing_payload.get('layers', []):
        try:
            entry_layer_id = int(layer_entry.get('id'))
        except (TypeError, ValueError, AttributeError):
            merged_layers.append(layer_entry)
            continue
        if entry_layer_id == numeric_layer_id:
            merged_layers.append(incoming_layer_entry)
            replaced = True
        else:
            merged_layers.append(layer_entry)

    if not replaced:
        merged_layers.append(incoming_layer_entry)

    merged_payload['layers'] = merged_layers
    return _serialize_frame_content_payload(merged_payload)


def serialize_project_card(project, first_frame=None, membership=None):
    frame_payload = serialize_frame(first_frame) if first_frame else {
        'preview_url': '',
        'updated_at': project.updated_at.isoformat() if project.updated_at else '',
        'has_preview': False,
    }
    current_user = getattr(project, '_current_user', None)
    membership = membership or get_project_membership(getattr(project, '_current_user', None), project)
    current_user_role = membership.role if membership and membership.is_active else None
    can_edit = membership.can_edit() if membership else False
    can_manage_members = membership.can_manage_members() if membership else False
    owner_display = project.owner.display_name or project.owner.email
    is_owned = bool(current_user and getattr(current_user, 'id', None) == project.owner_id)
    return {
        'id': project.pk,
        'title': project.title,
        'width': project.width,
        'height': project.height,
        'fps': project.fps,
        'owner_display': owner_display,
        'owner_email': project.owner.email,
        'is_owned': is_owned,
        'current_user_role': current_user_role,
        'can_edit': can_edit,
        'can_manage_members': can_manage_members,
        'updated_at': project.updated_at.isoformat() if project.updated_at else '',
        'preview_url': frame_payload.get('preview_url', ''),
        'has_preview': frame_payload.get('has_preview', False),
        'editor_url': reverse('animation:project_editor', kwargs={'pk': project.pk}),
        'share_url': reverse('animation:project_share', kwargs={'pk': project.pk}),
        'rename_url': reverse('animation:project_rename', kwargs={'pk': project.pk}),
        'delete_url': reverse('animation:project_delete', kwargs={'pk': project.pk}),
    }

def ensure_default_layer(frame):
    if frame.layers.exists():
        return
    Layer.objects.create(
        frame=frame,
        order=1,
        name='Background',
        visible=True,
        opacity=100,
    )


def reorder_layers(frame, ordered_ids=None):
    layers_qs = frame.layers.order_by('order', 'id')
    layers = list(layers_qs)
    if ordered_ids is None:
        ordered_layers = layers
    else:
        id_to_layer = {layer.pk: layer for layer in layers}
        ordered_layers = []
        for layer_id in ordered_ids:
            layer = id_to_layer.get(layer_id)
            if layer is not None:
                ordered_layers.append(layer)
        for layer in layers:
            if layer not in ordered_layers:
                ordered_layers.append(layer)

    total = len(ordered_layers)
    updates = []
    for index, layer in enumerate(ordered_layers):
        order_value = total - index
        if layer.order != order_value:
            layer.order = order_value
            updates.append(layer)
    if updates:
        Layer.objects.bulk_update(updates, ['order'])
    return ordered_layers


def renumber_frames(project):
    frames = list(project.frames.order_by('index', 'id'))
    if not frames:
        return frames

    # Keep (project, index) unique while reordering by moving indices
    # into a temporary range before assigning the final 1..N sequence.
    temp_base = 1_000_000
    temp_updates = []
    for position, frame in enumerate(frames, start=1):
        temp_index = temp_base + position
        if frame.index != temp_index:
            frame.index = temp_index
            temp_updates.append(frame)
    if temp_updates:
        Frame.objects.bulk_update(temp_updates, ['index'])

    final_updates = []
    for position, frame in enumerate(frames, start=1):
        if frame.index != position:
            frame.index = position
            final_updates.append(frame)
    if final_updates:
        Frame.objects.bulk_update(final_updates, ['index'])

    # Return the frames in the final correct order.
    return list(project.frames.order_by('index', 'id'))


def reorder_frames(project, ordered_ids=None):
    frames = list(project.frames.order_by('index', 'id'))
    if not frames:
        return frames

    if ordered_ids is None:
        ordered_frames = frames
    else:
        id_to_frame = {frame.pk: frame for frame in frames}
        ordered_frames = []
        for frame_id in ordered_ids:
            frame = id_to_frame.get(frame_id)
            if frame is not None:
                ordered_frames.append(frame)
        for frame in frames:
            if frame not in ordered_frames:
                ordered_frames.append(frame)

    temp_base = 1_000_000
    temp_updates = []
    for position, frame in enumerate(ordered_frames, start=1):
        temp_index = temp_base + position
        if frame.index != temp_index:
            frame.index = temp_index
            temp_updates.append(frame)
    if temp_updates:
        Frame.objects.bulk_update(temp_updates, ['index'])

    final_updates = []
    for position, frame in enumerate(ordered_frames, start=1):
        if frame.index != position:
            frame.index = position
            final_updates.append(frame)
    if final_updates:
        Frame.objects.bulk_update(final_updates, ['index'])

    return list(project.frames.order_by('index', 'id'))


@login_required
def project_list(request):
    projects = get_accessible_projects_queryset(request.user).select_related('owner').prefetch_related(
        'frames',
        Prefetch(
            'memberships',
            queryset=ProjectMember.objects.filter(user=request.user),
            to_attr='current_user_memberships',
        ),
    ).order_by('-updated_at')
    project_cards = []
    owned_project_cards = []
    shared_project_cards = []
    for project in projects:
        frames = list(project.frames.all())
        first_frame = frames[0] if frames else None
        project._current_user = request.user
        membership = project.current_user_memberships[0] if getattr(project, 'current_user_memberships', None) else None
        card = serialize_project_card(project, first_frame, membership=membership)
        project_cards.append(card)
        if card['is_owned']:
            owned_project_cards.append(card)
        else:
            shared_project_cards.append(card)

    continue_project = owned_project_cards[0] if owned_project_cards else (
        shared_project_cards[0] if shared_project_cards else None
    )
    return render(request, 'animation/project_list.html', {
        'project_cards': project_cards,
        'owned_project_cards': owned_project_cards,
        'shared_project_cards': shared_project_cards,
        'continue_project': continue_project,
    })


@login_required
def project_create(request):
    if request.method == 'POST':
        is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
        title = (request.POST.get('title') or '').strip() or 'New project'

        def parse_int(value, default_value):
            try:
                parsed = int(value)
            except (TypeError, ValueError):
                return default_value
            return parsed if parsed > 0 else default_value

        fps = parse_int(request.POST.get('fps'), 12)
        width = parse_int(request.POST.get('width'), 1280)
        height = parse_int(request.POST.get('height'), 720)

        project = AnimationProject.objects.create(
            owner=request.user,
            title=title,
            fps=fps,
            width=width,
            height=height,
        )

        # Create the first empty frame and its background layer immediately.
        frame = Frame.objects.create(project=project, index=1)
        ensure_default_layer(frame)

        if is_ajax:
            project._current_user = request.user
            return JsonResponse({
                'ok': True,
                'project': serialize_project_card(project, frame),
            })

        return redirect('animation:project_editor', pk=project.pk)

    return render(request, 'animation/project_create.html')


@login_required
def project_editor(request, pk):
    project = get_accessible_project_or_404(request.user, pk)
    membership = get_project_membership(request.user, project)
    first_frame = project.frames.order_by('index').first()
    current_frame_index = first_frame.index if first_frame else 1
    current_frame_preview_url = ''
    current_frame_updated_at = ''
    if first_frame:
        if first_frame.preview_image:
            current_frame_preview_url = first_frame.preview_image.url
        if first_frame.preview_image or first_frame.content_json:
            current_frame_updated_at = first_frame.updated_at.isoformat()
    return render(request, 'animation/editor.html', {
        'project': project,
        'current_user_role': membership.role if membership else '',
        'can_edit': membership.can_edit() if membership else False,
        'can_manage_members': membership.can_manage_members() if membership else False,
        'share_url': reverse('animation:project_share', kwargs={'pk': project.pk}),
        'current_frame_index': current_frame_index,
        'current_frame_preview_url': current_frame_preview_url,
        'current_frame_updated_at': current_frame_updated_at,
    })


def project_rename(request, pk):
    project = get_manageable_project_or_404(request.user, pk)
    is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'

    if request.method == 'POST':
        posted_id = request.POST.get('project_id')
        if posted_id and str(project.pk) != posted_id:
            if is_ajax:
                return JsonResponse({'ok': False, 'error': 'invalid_project'}, status=400)
            messages.error(request, 'Invalid project.')
            return redirect('animation:project_list')

        new_title = (request.POST.get('new_title') or '').strip()
        if not new_title:
            if is_ajax:
                return JsonResponse({'ok': False, 'error': 'empty_title'}, status=400)
            messages.error(request, 'Title cannot be empty.')
            return redirect('animation:project_list')

        project.title = new_title
        project.save(update_fields=['title'])
        if is_ajax:
            return JsonResponse({
                'ok': True,
                'project_id': project.pk,
                'title': project.title,
            })
        messages.success(request, 'Project title updated.')
        return redirect('animation:project_list')

    return render(request, 'animation/project_rename.html', {
        'project': project,
    })


@login_required
@require_POST
def project_delete(request, pk):
    project = get_manageable_project_or_404(request.user, pk)
    is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
    project_title = project.title
    project.delete()
    if is_ajax:
        return JsonResponse({
            'ok': True,
            'project_id': pk,
            'title': project_title,
        })
    messages.success(request, f'Project "{project_title}" deleted.')
    return redirect('animation:project_list')


@login_required
@require_POST
def project_save(request, pk):
    project = get_editable_project_or_404(request.user, pk)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'invalid_payload'}, status=400)

    frames = payload.get('frames')
    client_request_id = normalize_client_request_id(payload.get('client_request_id'))
    if not isinstance(frames, list) or not frames:
        return JsonResponse({'ok': False, 'error': 'no_frames'}, status=400)

    saved_indices = []
    saved_frames = []
    with transaction.atomic():
        for frame_data in frames:
            if not isinstance(frame_data, dict):
                continue

            try:
                index = int(frame_data.get('index'))
            except (TypeError, ValueError):
                continue

            content = frame_data.get('content')
            if content is None:
                continue

            if isinstance(content, str):
                content_json = content
            else:
                content_json = json.dumps(content, ensure_ascii=False)

            frame, created = Frame.objects.get_or_create(
                project=project,
                index=index,
                defaults={
                    'content_json': content_json,
                    'content_revision': 1,
                },
            )
            if not created:
                frame.content_json = content_json
                frame.content_revision += 1
                frame.save(update_fields=['content_json', 'content_revision', 'updated_at'])

            saved_indices.append(index)
            saved_frames.append(frame)

        if not saved_indices:
            return JsonResponse({'ok': False, 'error': 'no_valid_frames'}, status=400)

        project.save(update_fields=['updated_at'])
        event_payloads = [
            build_frame_content_updated_payload(frame, request.user.pk, client_request_id)
            for frame in saved_frames
        ]

        def broadcast_saved_frame_updates(project_id=project.pk, payloads=event_payloads):
            for event_payload in payloads:
                broadcast_project_event(project_id, 'frame_content_updated', event_payload)

        transaction.on_commit(broadcast_saved_frame_updates)

    return JsonResponse({'ok': True, 'saved_frames': saved_indices})


@login_required
@require_POST
def project_update(request, pk):
    project = get_editable_project_or_404(request.user, pk)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'invalid_payload'}, status=400)

    if 'fps' not in payload:
        return JsonResponse({'ok': False, 'error': 'fps_required'}, status=400)

    fps = _parse_int(payload.get('fps'), default_value=None, min_value=1, max_value=60)
    if fps is None:
        return JsonResponse({'ok': False, 'error': 'invalid_fps'}, status=400)

    project.fps = fps
    project.save(update_fields=['fps', 'updated_at'])

    return JsonResponse({
        'ok': True,
        'project': {
            'id': project.pk,
            'fps': project.fps,
            'updated_at': project.updated_at.isoformat() if project.updated_at else '',
        },
    })


@login_required
@require_http_methods(["GET", "POST"])
def project_comments(request, pk):
    project = get_accessible_project_or_404(request.user, pk)
    membership = get_project_membership(request.user, project)

    if request.method == 'GET':
        comments = ProjectComment.objects.filter(project=project).select_related(
            'author',
            'frame',
            'resolved_by',
        )
        return JsonResponse({
            'ok': True,
            'comments': [
                serialize_project_comment(comment, request.user, membership)
                for comment in comments
            ],
        })

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'invalid_payload'}, status=400)

    body = (payload.get('body') or '').strip()
    if not body:
        return JsonResponse({'ok': False, 'error': 'empty_body'}, status=400)
    if len(body) > MAX_PROJECT_COMMENT_BODY_LENGTH:
        return JsonResponse({'ok': False, 'error': 'body_too_long'}, status=400)

    frame = None
    frame_id = payload.get('frame_id')
    if frame_id not in (None, ''):
        try:
            normalized_frame_id = int(frame_id)
        except (TypeError, ValueError):
            return JsonResponse({'ok': False, 'error': 'invalid_frame'}, status=400)
        frame = Frame.objects.filter(project=project, pk=normalized_frame_id).first()
        if frame is None:
            return JsonResponse({'ok': False, 'error': 'invalid_frame'}, status=400)

    client_request_id = normalize_client_request_id(payload.get('client_request_id'))
    comment = ProjectComment.objects.create(
        project=project,
        frame=frame,
        author=request.user,
        body=body,
    )
    comment_payload = serialize_project_comment(comment, request.user, membership)
    transaction.on_commit(
        lambda project_id=project.pk, event_payload={
            'comment': comment_payload,
            'actor_user_id': request.user.pk,
            'client_request_id': client_request_id,
        }: broadcast_project_event(project_id, 'project_comment_created', event_payload)
    )
    return JsonResponse({
        'ok': True,
        'comment': comment_payload,
    })


@login_required
@require_POST
def project_comment_resolve(request, pk, comment_id):
    project = get_accessible_project_or_404(request.user, pk)
    membership = get_project_membership(request.user, project)
    if membership is None or not membership.can_edit():
        return JsonResponse({'ok': False, 'error': 'permission_denied'}, status=403)

    comment = get_object_or_404(
        ProjectComment.objects.select_related('author', 'frame', 'resolved_by'),
        project=project,
        pk=comment_id,
    )

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'invalid_payload'}, status=400)

    next_resolved = bool(payload.get('is_resolved', True))
    client_request_id = normalize_client_request_id(payload.get('client_request_id'))
    if next_resolved:
        comment.is_resolved = True
        comment.resolved_at = timezone.now()
        comment.resolved_by = request.user
    else:
        comment.is_resolved = False
        comment.resolved_at = None
        comment.resolved_by = None
    comment.save(update_fields=['is_resolved', 'resolved_at', 'resolved_by', 'updated_at'])

    comment_payload = serialize_project_comment(comment, request.user, membership)
    transaction.on_commit(
        lambda project_id=project.pk, event_payload={
            'comment': comment_payload,
            'actor_user_id': request.user.pk,
            'client_request_id': client_request_id,
        }: broadcast_project_event(project_id, 'project_comment_resolved', event_payload)
    )
    return JsonResponse({
        'ok': True,
        'comment': comment_payload,
    })


@login_required
@require_POST
def project_comment_delete(request, pk, comment_id):
    project = get_accessible_project_or_404(request.user, pk)
    membership = get_project_membership(request.user, project)
    comment = get_object_or_404(
        ProjectComment.objects.select_related('author', 'frame'),
        project=project,
        pk=comment_id,
    )
    if comment.author_id != request.user.pk and (membership is None or not membership.can_manage_members()):
        return JsonResponse({'ok': False, 'error': 'permission_denied'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        payload = {}
    client_request_id = normalize_client_request_id(payload.get('client_request_id') if isinstance(payload, dict) else '')
    comment_payload = serialize_project_comment(comment, request.user, membership)
    comment.delete()
    transaction.on_commit(
        lambda project_id=project.pk, event_payload={
            'comment_id': comment_id,
            'comment': comment_payload,
            'actor_user_id': request.user.pk,
            'client_request_id': client_request_id,
        }: broadcast_project_event(project_id, 'project_comment_deleted', event_payload)
    )
    return JsonResponse({
        'ok': True,
        'comment_id': comment_id,
    })


@login_required
@require_http_methods(["GET"])
def frames_list(request, pk):
    project = get_accessible_project_or_404(request.user, pk)
    frames = project.frames.order_by('index', 'id')
    return JsonResponse({
        'ok': True,
        'frames': [serialize_frame(frame) for frame in frames],
    })


@login_required
@require_http_methods(["GET"])
def frame_detail(request, pk, index):
    project = get_accessible_project_or_404(request.user, pk)
    frame = get_object_or_404(Frame, project=project, index=index)
    ensure_default_layer(frame)
    layers = frame.layers.order_by('order', 'id')
    return JsonResponse({
        'ok': True,
        'frame': {
            **serialize_frame(frame),
            'content_json': frame.content_json or '',
        },
        'layers': [serialize_layer(layer) for layer in layers],
    })


@login_required
@require_POST
def frame_create(request, pk):
    project = get_editable_project_or_404(request.user, pk)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    duplicate_from_index = payload.get('duplicate_from_index')
    client_request_id = normalize_client_request_id(payload.get('client_request_id'))
    try:
        duplicate_from_index = int(duplicate_from_index) if duplicate_from_index is not None else None
    except (TypeError, ValueError):
        duplicate_from_index = None

    with transaction.atomic():
        last_index = project.frames.aggregate(max_index=Max('index')).get('max_index') or 0
        next_index = last_index + 1

        new_frame = Frame.objects.create(project=project, index=next_index)

        if duplicate_from_index is not None:
            try:
                source = Frame.objects.select_related('project').get(project=project, index=duplicate_from_index)
            except Frame.DoesNotExist:
                source = None

            if source is not None:
                new_frame.content_json = source.content_json or ''

                # Copy the preview image file when it exists.
                if source.preview_image:
                    try:
                        source.preview_image.open('rb')
                        data = source.preview_image.read()
                        if data:
                            filename = f'project_{project.pk}_frame_{new_frame.index}.png'
                            new_frame.preview_image.save(filename, ContentFile(data), save=False)
                    except Exception:
                        pass
                    finally:
                        try:
                            source.preview_image.close()
                        except Exception:
                            pass

                new_frame.save()

                # Copy layer metadata.
                source_layers = list(source.layers.order_by('order', 'id'))
                if source_layers:
                    Layer.objects.bulk_create([
                        Layer(
                            frame=new_frame,
                            order=item.order,
                            name=item.name,
                            visible=item.visible,
                            opacity=item.opacity,
                        ) for item in source_layers
                    ])
                else:
                    ensure_default_layer(new_frame)
            else:
                ensure_default_layer(new_frame)
        else:
            ensure_default_layer(new_frame)

        project.save(update_fields=['updated_at'])
        response_frames = [serialize_frame(frame) for frame in project.frames.order_by('index', 'id')]
        response_frame = serialize_frame(new_frame)
        transaction.on_commit(
            lambda project_id=project.pk, payload={
                'frame': response_frame,
                'frames': response_frames,
                'active_index': new_frame.index,
                'actor_user_id': request.user.pk,
                'client_request_id': client_request_id,
            }: broadcast_project_event(project_id, 'frame_created', payload)
        )

    return JsonResponse({
        'ok': True,
        'active_index': new_frame.index,
        'frame': response_frame,
        'frames': response_frames,
    })


@login_required
@require_POST
def frame_delete(request, pk, index):
    project = get_editable_project_or_404(request.user, pk)
    frame = get_object_or_404(Frame, project=project, index=index)
    deleted_frame_id = frame.pk
    deleted_frame_index = frame.index

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        payload = {}
    client_request_id = normalize_client_request_id(payload.get('client_request_id'))

    with transaction.atomic():
        frame.delete()

        # If this was the last frame, create a new empty one so the project always has a frame.
        if project.frames.count() == 0:
            new_frame = Frame.objects.create(project=project, index=1)
            ensure_default_layer(new_frame)
            frames = [new_frame]
        else:
            frames = renumber_frames(project)
        project.save(update_fields=['updated_at'])
        response_frames = [serialize_frame(item) for item in frames]

    # Activate the nearest frame based on position after renumbering.
    next_total = len(frames)
    next_active_index = min(max(1, index), next_total) if next_total else 1
    transaction.on_commit(
        lambda project_id=project.pk, event_payload={
            'frame_id': deleted_frame_id,
            'deleted_frame_index': deleted_frame_index,
            'active_index': next_active_index,
            'frames': response_frames,
            'actor_user_id': request.user.pk,
            'client_request_id': client_request_id,
        }: broadcast_project_event(project_id, 'frame_deleted', event_payload)
    )

    return JsonResponse({
        'ok': True,
        'active_index': next_active_index,
        'frames': [serialize_frame(item) for item in frames],
    })


@login_required
@require_POST
def frame_reorder(request, pk):
    project = get_editable_project_or_404(request.user, pk)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    ordered_ids = payload.get('ordered_ids')
    if not isinstance(ordered_ids, list):
        return JsonResponse({'ok': False, 'error': 'invalid_order'}, status=400)

    normalized_ids = []
    for item in ordered_ids:
        try:
            normalized_ids.append(int(item))
        except (TypeError, ValueError):
            continue

    with transaction.atomic():
        frames = reorder_frames(project, normalized_ids)
        project.save(update_fields=['updated_at'])
        response_frames = [serialize_frame(item) for item in frames]
        transaction.on_commit(
            lambda project_id=project.pk, payload={
                'frames': response_frames,
                'actor_user_id': request.user.pk,
                'client_request_id': normalize_client_request_id(payload.get('client_request_id')),
            }: broadcast_project_event(project_id, 'frame_reordered', payload)
        )

    return JsonResponse({
        'ok': True,
        'frames': response_frames,
    })


@login_required
@require_POST
def frame_save(request, pk, index):
    project = get_editable_project_or_404(request.user, pk)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except RequestDataTooBig:
        max_mb = max(1, settings.DATA_UPLOAD_MAX_MEMORY_SIZE // (1024 * 1024))
        return JsonResponse({
            'ok': False,
            'error': f'Image payload is too large. Maximum request size is {max_mb} MB.',
        }, status=413)
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Invalid JSON.'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'Invalid payload format.'}, status=400)

    client_request_id = normalize_client_request_id(payload.get('client_request_id'))
    active_layer_id = payload.get('active_layer_id')
    active_layer_revision = payload.get('active_layer_revision')
    presence_session_id = payload.get('presence_session_id')
    image_data = payload.get('image_data')
    content_json = payload.get('content_json')
    preview_bytes = None
    preview_filename = ''
    needs_authoritative_refresh = False

    if isinstance(image_data, str):
        image_data = image_data.strip()
        if not image_data:
            image_data = None

    if image_data is None and content_json is None:
        return JsonResponse({'ok': False, 'error': 'No data provided for saving.'}, status=400)

    if image_data is not None:
        if not isinstance(image_data, str):
            return JsonResponse({'ok': False, 'error': 'Invalid image data.'}, status=400)

        header = ''
        encoded = image_data
        if image_data.startswith('data:'):
            try:
                header, encoded = image_data.split(',', 1)
            except ValueError:
                return JsonResponse({'ok': False, 'error': 'Invalid image data.'}, status=400)
            encoded = encoded.strip()

        try:
            decoded = base64.b64decode(encoded, validate=True)
        except (BinasciiError, ValueError):
            return JsonResponse({'ok': False, 'error': 'Invalid image data.'}, status=400)

        if not decoded:
            return JsonResponse({'ok': False, 'error': 'The image is empty.'}, status=400)

        if len(decoded) > MAX_PREVIEW_IMAGE_BYTES:
            max_mb = MAX_PREVIEW_IMAGE_BYTES // (1024 * 1024)
            return JsonResponse({
                'ok': False,
                'error': f'Image is too large. Maximum size is {max_mb} MB.',
            }, status=413)

        extension = 'png'
        if header.startswith('data:'):
            mime_type = header.split(';', 1)[0][5:]
            if mime_type == 'image/jpeg':
                extension = 'jpg'
            elif mime_type == 'image/webp':
                extension = 'webp'
            elif mime_type == 'image/png':
                extension = 'png'

        preview_bytes = decoded
        preview_filename = f'project_{project.pk}_frame_{index}.{extension}'

    with transaction.atomic():
        frame = get_object_or_404(
            Frame.objects.select_for_update(),
            project=project,
            index=index,
        )
        active_layer = None
        if active_layer_id is not None:
            active_layer = Layer.objects.select_for_update().filter(frame=frame, pk=active_layer_id).first()
            if active_layer is None:
                return JsonResponse({'ok': False, 'error': 'Invalid active layer.'}, status=400)
            if presence_session_id is None or not presence_session_holds_layer_lock(
                project_id=project.pk,
                layer_id=active_layer.pk,
                user_id=request.user.pk,
                presence_session_id=presence_session_id,
            ):
                return JsonResponse({'ok': False, 'error': 'Layer lock required.'}, status=409)
            if active_layer_revision is not None:
                try:
                    expected_layer_revision = int(active_layer_revision)
                except (TypeError, ValueError):
                    return JsonResponse({'ok': False, 'error': 'Invalid layer revision.'}, status=400)
                if expected_layer_revision != active_layer.content_revision:
                    return JsonResponse({
                        'ok': False,
                        'error': 'Layer content is stale. Refresh the frame and try again.',
                    }, status=409)

        if content_json is not None:
            try:
                normalized_incoming_content_json = _normalize_frame_content_payload(content_json)
                merged_content_json = _merge_active_layer_content(frame.content_json, content_json, active_layer_id)
            except (TypeError, ValueError):
                return JsonResponse({'ok': False, 'error': 'Invalid JSON data.'}, status=400)
            frame.content_json = merged_content_json
            needs_authoritative_refresh = merged_content_json != normalized_incoming_content_json

        if preview_bytes is not None:
            frame.preview_image.save(preview_filename, ContentFile(preview_bytes), save=False)

        if active_layer is not None:
            active_layer.content_revision += 1
            active_layer.save(update_fields=['content_revision'])
        frame.content_revision += 1
        frame.save()
        project.save(update_fields=['updated_at'])
        layer_commit_payload = (
            build_layer_content_committed_payload(
                frame,
                active_layer,
                request.user.pk,
                client_request_id,
                presence_session_id=presence_session_id,
            )
            if active_layer is not None else None
        )
        if layer_commit_payload is not None:
            transaction.on_commit(
                lambda project_id=project.pk, payload=layer_commit_payload: broadcast_project_event(
                    project_id,
                    'layer_content_committed',
                    payload,
                )
            )
        else:
            event_payload = build_frame_content_updated_payload(frame, request.user.pk, client_request_id)
            transaction.on_commit(
                lambda project_id=project.pk, payload=event_payload: broadcast_project_event(
                    project_id,
                    'frame_content_updated',
                    payload,
                )
            )

    return JsonResponse(
        build_frame_save_response_payload(
            frame,
            active_layer,
            needs_authoritative_refresh=needs_authoritative_refresh,
        )
    )


@login_required
@require_http_methods(["GET", "POST"])
def frame_layers(request, pk, index):
    if request.method == 'GET':
        project = get_accessible_project_or_404(request.user, pk)
    else:
        project = get_editable_project_or_404(request.user, pk)
    frame = get_object_or_404(Frame, project=project, index=index)
    ensure_default_layer(frame)

    if request.method == 'GET':
        layers = frame.layers.order_by('order', 'id')
        return JsonResponse({
            'ok': True,
            'layers': [serialize_layer(layer) for layer in layers],
        })

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    name = (payload.get('name') or '').strip()
    if not name:
        name = f'Layer {frame.layers.count() + 1}'

    last_layer = frame.layers.order_by('-order', '-id').first()
    next_order = (last_layer.order if last_layer else 0) + 1
    layer = Layer.objects.create(
        frame=frame,
        order=next_order,
        name=name,
        visible=True,
        opacity=100,
    )
    layer_payload = serialize_layer(layer)
    transaction.on_commit(
        lambda project_id=project.pk, event_payload={
            'frame_id': frame.pk,
            'frame_index': frame.index,
            'layer': layer_payload,
            'actor_user_id': request.user.pk,
            'client_request_id': normalize_client_request_id(payload.get('client_request_id')),
        }: broadcast_project_event(project_id, 'layer_created', event_payload)
    )
    return JsonResponse({
        'ok': True,
        'layer': layer_payload,
    })


@login_required
@require_POST
def layer_update(request, pk, index, layer_id):
    project = get_editable_project_or_404(request.user, pk)
    frame = get_object_or_404(Frame, project=project, index=index)
    layer = get_object_or_404(Layer, frame=frame, pk=layer_id)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    update_fields = []

    if 'name' in payload:
        name = (payload.get('name') or '').strip()
        if not name:
            return JsonResponse({'ok': False, 'error': 'empty_name'}, status=400)
        layer.name = name
        update_fields.append('name')

    if 'visible' in payload:
        layer.visible = bool(payload.get('visible'))
        update_fields.append('visible')

    if 'opacity' in payload:
        try:
            opacity = int(payload.get('opacity'))
        except (TypeError, ValueError):
            return JsonResponse({'ok': False, 'error': 'invalid_opacity'}, status=400)
        layer.opacity = max(0, min(100, opacity))
        update_fields.append('opacity')

    if update_fields:
        layer.save(update_fields=update_fields)
        layer_payload = serialize_layer(layer)
        event_type_map = {
            'name': 'layer_renamed',
            'visible': 'layer_visibility_changed',
            'opacity': 'layer_opacity_changed',
        }
        client_request_id = normalize_client_request_id(payload.get('client_request_id'))
        for field_name in update_fields:
            event_type = event_type_map.get(field_name)
            if not event_type:
                continue
            transaction.on_commit(
                lambda project_id=project.pk, current_event_type=event_type, event_payload={
                    'frame_id': frame.pk,
                    'frame_index': frame.index,
                    'layer_id': layer.pk,
                    'layer': layer_payload,
                    'actor_user_id': request.user.pk,
                    'client_request_id': client_request_id,
                }: broadcast_project_event(project_id, current_event_type, event_payload)
            )

    return JsonResponse({
        'ok': True,
        'layer': serialize_layer(layer),
    })


@login_required
@require_POST
def layer_delete(request, pk, index, layer_id):
    project = get_editable_project_or_404(request.user, pk)
    frame = get_object_or_404(Frame, project=project, index=index)
    layer = get_object_or_404(Layer, frame=frame, pk=layer_id)
    deleted_layer_id = layer.pk
    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        payload = {}
    layer.delete()
    ensure_default_layer(frame)
    reorder_layers(frame)
    layers = frame.layers.order_by('order', 'id')
    response_layers = [serialize_layer(item) for item in layers]
    transaction.on_commit(
        lambda project_id=project.pk, event_payload={
            'frame_id': frame.pk,
            'frame_index': frame.index,
            'layer_id': deleted_layer_id,
            'layers': response_layers,
            'actor_user_id': request.user.pk,
            'client_request_id': normalize_client_request_id(payload.get('client_request_id')),
        }: broadcast_project_event(project_id, 'layer_deleted', event_payload)
    )
    return JsonResponse({
        'ok': True,
        'layers': response_layers,
    })


@login_required
@require_POST
def layer_reorder(request, pk, index):
    project = get_editable_project_or_404(request.user, pk)
    frame = get_object_or_404(Frame, project=project, index=index)
    ensure_default_layer(frame)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    ordered_ids = payload.get('ordered_ids')
    if not isinstance(ordered_ids, list):
        return JsonResponse({'ok': False, 'error': 'invalid_order'}, status=400)

    normalized_ids = []
    for item in ordered_ids:
        try:
            normalized_ids.append(int(item))
        except (TypeError, ValueError):
            continue

    reorder_layers(frame, normalized_ids)
    layers = frame.layers.order_by('order', 'id')
    response_layers = [serialize_layer(layer) for layer in layers]
    transaction.on_commit(
        lambda project_id=project.pk, event_payload={
            'frame_id': frame.pk,
            'frame_index': frame.index,
            'layers': response_layers,
            'actor_user_id': request.user.pk,
            'client_request_id': normalize_client_request_id(payload.get('client_request_id')),
        }: broadcast_project_event(project_id, 'layer_reordered', event_payload)
    )
    return JsonResponse({
        'ok': True,
        'layers': response_layers,
    })


def _parse_int(value, default_value=None, min_value=None, max_value=None):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default_value
    if min_value is not None:
        parsed = max(min_value, parsed)
    if max_value is not None:
        parsed = min(max_value, parsed)
    return parsed


def _normalize_resolution_key(value):
    if not isinstance(value, str):
        return 'original'
    value = value.strip().lower()
    if value in ('original', 'orig', 'source'):
        return 'original'
    if value in ('720p', '1280x720'):
        return '720p'
    if value in ('1080p', '1920x1080'):
        return '1080p'
    return 'original'


def _get_export_size(project, resolution_key):
    if resolution_key == '720p':
        return 1280, 720
    if resolution_key == '1080p':
        return 1920, 1080
    return int(project.width), int(project.height)


def _get_even_video_size(width, height):
    return int(width) + (int(width) % 2), int(height) + (int(height) % 2)


def _get_pillow_resample():
    # Pillow 9+: Image.Resampling.LANCZOS; older versions: Image.LANCZOS
    try:
        from PIL import Image  # pylint: disable=import-outside-toplevel
        return Image.Resampling.LANCZOS
    except Exception:
        try:
            from PIL import Image  # pylint: disable=import-outside-toplevel
            return Image.LANCZOS
        except Exception:
            return 1  # PIL.Image.NEAREST (fallback)


def _load_frame_rgba(frame, fallback_size):
    try:
        from PIL import Image  # pylint: disable=import-outside-toplevel
    except Exception as exc:
        raise RuntimeError('Pillow is not installed. Install Pillow to export images.') from exc

    width, height = fallback_size
    if frame.preview_image:
        try:
            path = frame.preview_image.path
            with Image.open(path) as im:
                rgba = im.convert('RGBA')
            return rgba
        except Exception:
            # Return an empty frame if the file is broken or unavailable.
            pass
    return Image.new('RGBA', (int(width), int(height)), (0, 0, 0, 0))


def _fit_to_exact_size(image_rgba, out_size):
    try:
        from PIL import Image  # pylint: disable=import-outside-toplevel
    except Exception as exc:
        raise RuntimeError('Pillow is not installed. Install Pillow to export images.') from exc

    out_w, out_h = int(out_size[0]), int(out_size[1])
    if out_w <= 0 or out_h <= 0:
        return image_rgba

    src_w, src_h = image_rgba.size
    if src_w == out_w and src_h == out_h:
        return image_rgba

    resample = _get_pillow_resample()
    scale = min(out_w / src_w, out_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = image_rgba.resize((new_w, new_h), resample=resample)

    canvas = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    offset_x = (out_w - new_w) // 2
    offset_y = (out_h - new_h) // 2
    canvas.alpha_composite(resized, (offset_x, offset_y))
    return canvas


def _flatten_rgba_to_rgb(image_rgba, background=(255, 255, 255, 255)):
    try:
        from PIL import Image  # pylint: disable=import-outside-toplevel
    except Exception as exc:
        raise RuntimeError('Pillow is not installed. Install Pillow to export images.') from exc

    canvas = Image.new('RGBA', image_rgba.size, background)
    canvas.alpha_composite(image_rgba)
    return canvas.convert('RGB')


def _build_video_ffmpeg_command(ffmpeg_path, export_format, input_pattern, fps, abs_path):
    playback_filter = f'fps={VIDEO_ENCODE_PLAYBACK_FPS}'
    base_command = [
        ffmpeg_path,
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-framerate',
        str(int(fps)),
        '-i',
        input_pattern,
    ]
    if export_format == 'mp4':
        return [
            *base_command,
            '-vf',
            f'{playback_filter},format=yuv420p',
            '-c:v',
            'libx264',
            '-preset',
            'medium',
            '-crf',
            '18',
            '-movflags',
            '+faststart',
            abs_path,
        ]
    return [
        *base_command,
        '-vf',
        f'{playback_filter},format=yuva420p',
        '-c:v',
        'libvpx-vp9',
        '-pix_fmt',
        'yuva420p',
        '-auto-alt-ref',
        '0',
        '-b:v',
        '0',
        '-crf',
        '31',
        abs_path,
    ]


def _encode_video_export(frames, source_size, out_size, fps, export_format, abs_dir, abs_path):
    ffmpeg_path = shutil.which('ffmpeg')
    if not ffmpeg_path:
        raise RuntimeError('ffmpeg is not installed. Install ffmpeg to export MP4 or WebM video.')

    digits = max(6, len(str(len(frames))))
    with tempfile.TemporaryDirectory(prefix='video_export_', dir=abs_dir) as temp_dir:
        for idx, frame in enumerate(frames, start=1):
            rgba = _load_frame_rgba(frame, fallback_size=source_size)
            fitted = _fit_to_exact_size(rgba, out_size)
            if export_format == 'mp4':
                image = _flatten_rgba_to_rgb(fitted)
            else:
                image = fitted
            image.save(os.path.join(temp_dir, f'frame_{idx:0{digits}d}.png'), format='PNG')

        input_pattern = os.path.join(temp_dir, f'frame_%0{digits}d.png')
        command = _build_video_ffmpeg_command(ffmpeg_path, export_format, input_pattern, fps, abs_path)
        try:
            subprocess.run(command, check=True, capture_output=True)
        except subprocess.CalledProcessError as exc:
            stderr = ''
            try:
                stderr = (exc.stderr or b'').decode('utf-8', errors='replace').strip()
            except Exception:
                stderr = ''
            if stderr:
                raise RuntimeError(f'ffmpeg could not generate the video: {stderr[:400]}') from exc
            raise RuntimeError('ffmpeg could not generate the video.') from exc


def _ensure_export_dir(user_id, project_id):
    rel_dir = os.path.join(EXPORT_BASE_DIR, f'user_{user_id}', f'project_{project_id}')
    abs_dir = os.path.join(settings.MEDIA_ROOT, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)
    return rel_dir.replace('\\', '/'), abs_dir


def _build_export_token(user_id, project_id, rel_path):
    payload = {
        'u': int(user_id),
        'p': int(project_id),
        'path': str(rel_path),
    }
    return signing.dumps(payload, salt=EXPORT_SIGNING_SALT, compress=True)


def _decode_export_token(token, max_age_seconds):
    return signing.loads(token, salt=EXPORT_SIGNING_SALT, max_age=max_age_seconds)


def _safe_media_path(rel_path):
    rel_path = (rel_path or '').replace('\\', '/')
    if not rel_path.startswith(f'{EXPORT_BASE_DIR}/'):
        return None
    if '..' in rel_path.split('/'):
        return None
    abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
    abs_root = os.path.abspath(settings.MEDIA_ROOT)
    abs_path = os.path.abspath(abs_path)
    if not abs_path.startswith(abs_root):
        return None
    return abs_path


@login_required
@require_POST
def project_export(request, pk):
    project = get_accessible_project_or_404(request.user, pk)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json', 'message': 'Invalid JSON.'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'invalid_payload', 'message': 'Invalid payload format.'}, status=400)

    export_format = (payload.get('format') or '').strip().lower()
    if export_format in ('png', 'png_zip', 'png-seq', 'png_sequence', 'zip'):
        export_format = 'png_zip'
    elif export_format in ('gif', 'gif_file'):
        export_format = 'gif'
    elif export_format in ('mp4', 'mpeg4', 'h264'):
        export_format = 'mp4'
    elif export_format in ('webm', 'vp9'):
        export_format = 'webm'
    else:
        return JsonResponse({'ok': False, 'error': 'invalid_format', 'message': 'Choose an export format.'}, status=400)

    resolution_key = _normalize_resolution_key(payload.get('resolution'))
    out_w, out_h = _get_export_size(project, resolution_key)
    if export_format in {'mp4', 'webm'}:
        out_w, out_h = _get_even_video_size(out_w, out_h)

    frames_qs = project.frames.order_by('index', 'id')
    frames = list(frames_qs)
    total_frames = len(frames)
    if total_frames <= 0:
        return JsonResponse({'ok': False, 'error': 'no_frames', 'message': 'The project has no frames.'}, status=400)

    if export_format == 'gif' and total_frames > MAX_EXPORT_GIF_FRAMES:
        return JsonResponse({
            'ok': False,
            'error': 'too_many_frames',
            'message': f'Too many frames for GIF export ({total_frames}). Try PNG sequence export or reduce the frame count.',
            'limits': {'max_gif_frames': MAX_EXPORT_GIF_FRAMES},
        }, status=413)

    if export_format == 'png_zip' and total_frames > MAX_EXPORT_PNG_ZIP_FRAMES:
        return JsonResponse({
            'ok': False,
            'error': 'too_many_frames',
            'message': f'Too many frames for export ({total_frames}). Reduce the frame count.',
            'limits': {'max_png_zip_frames': MAX_EXPORT_PNG_ZIP_FRAMES},
        }, status=413)

    if export_format in {'mp4', 'webm'} and total_frames > MAX_EXPORT_VIDEO_FRAMES:
        return JsonResponse({
            'ok': False,
            'error': 'too_many_frames',
            'message': f'Too many frames for video export ({total_frames}). Try PNG sequence export or reduce the frame count.',
            'limits': {'max_video_frames': MAX_EXPORT_VIDEO_FRAMES},
        }, status=413)

    if export_format in {'gif', 'mp4', 'webm'}:
        fps = _parse_int(payload.get('fps'), default_value=int(project.fps), min_value=1, max_value=60)
    else:
        fps = None

    if export_format == 'gif':
        loop_infinite = bool(payload.get('loop_infinite', True))
        loop_count = _parse_int(payload.get('loop_count'), default_value=0, min_value=0, max_value=10_000)
        loop_value = 0 if loop_infinite or loop_count == 0 else loop_count
    else:
        loop_value = None

    rel_dir, abs_dir = _ensure_export_dir(request.user.id, project.pk)

    safe_title = (project.title or 'project').strip()
    safe_title = ''.join(ch for ch in safe_title if ch.isalnum() or ch in (' ', '-', '_')).strip() or 'project'
    safe_title = safe_title.replace(' ', '_')

    # Frames are read from preview_image because they are already flattened client-side.
    source_size = (int(project.width), int(project.height))

    if export_format == 'png_zip':
        digits = max(4, len(str(total_frames)))
        filename = f'{safe_title}_png_seq_{out_w}x{out_h}.zip'
        abs_path = os.path.join(abs_dir, filename)
        try:
            with zipfile.ZipFile(abs_path, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
                for idx, frame in enumerate(frames, start=1):
                    name = f'frame_{idx:0{digits}d}.png'
                    rgba = _load_frame_rgba(frame, fallback_size=source_size)
                    fitted = _fit_to_exact_size(rgba, (out_w, out_h))
                    img_bytes = io.BytesIO()
                    fitted.save(img_bytes, format='PNG')
                    zf.writestr(name, img_bytes.getvalue())
        except RuntimeError as error:
            try:
                if os.path.exists(abs_path):
                    os.remove(abs_path)
            except Exception:
                pass
            return JsonResponse({'ok': False, 'error': 'export_unavailable', 'message': str(error)}, status=500)
        except Exception:
            try:
                if os.path.exists(abs_path):
                    os.remove(abs_path)
            except Exception:
                pass
            return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Could not generate the ZIP archive.'}, status=500)

        rel_path = f'{rel_dir}/{filename}'
        token = _build_export_token(request.user.id, project.pk, rel_path)
        download_url = reverse('animation:project_export_download', kwargs={'pk': project.pk, 'token': token})
        return JsonResponse({
            'ok': True,
            'format': 'png_zip',
            'filename': filename,
            'download_url': download_url,
        })

    if export_format in {'mp4', 'webm'}:
        try:
            total_pixels = int(out_w) * int(out_h) * int(total_frames)
        except Exception:
            total_pixels = 0
        if total_pixels and total_pixels > MAX_EXPORT_VIDEO_TOTAL_PIXELS:
            return JsonResponse({
                'ok': False,
                'error': 'video_too_large',
                'message': 'The video is too large to generate. Try reducing the resolution or frame count, or export a PNG sequence instead.',
                'limits': {'max_total_pixels': MAX_EXPORT_VIDEO_TOTAL_PIXELS},
            }, status=413)

        extension = 'mp4' if export_format == 'mp4' else 'webm'
        filename = f'{safe_title}_{out_w}x{out_h}_{fps}fps.{extension}'
        abs_path = os.path.join(abs_dir, filename)
        try:
            _encode_video_export(
                frames=frames,
                source_size=source_size,
                out_size=(out_w, out_h),
                fps=fps,
                export_format=export_format,
                abs_dir=abs_dir,
                abs_path=abs_path,
            )
        except RuntimeError as error:
            try:
                if os.path.exists(abs_path):
                    os.remove(abs_path)
            except Exception:
                pass
            return JsonResponse({'ok': False, 'error': 'export_unavailable', 'message': str(error)}, status=500)
        except Exception:
            try:
                if os.path.exists(abs_path):
                    os.remove(abs_path)
            except Exception:
                pass
            return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Could not generate the video.'}, status=500)

        try:
            if os.path.getsize(abs_path) > MAX_EXPORT_VIDEO_BYTES:
                os.remove(abs_path)
                return JsonResponse({
                    'ok': False,
                    'error': 'video_too_large',
                    'message': 'The video is too large. Try reducing the resolution, FPS, or frame count.',
                    'limits': {'max_video_bytes': MAX_EXPORT_VIDEO_BYTES},
                }, status=413)
        except OSError:
            return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Could not generate the video.'}, status=500)

        rel_path = f'{rel_dir}/{filename}'
        token = _build_export_token(request.user.id, project.pk, rel_path)
        download_url = reverse('animation:project_export_download', kwargs={'pk': project.pk, 'token': token})
        return JsonResponse({
            'ok': True,
            'format': export_format,
            'filename': filename,
            'download_url': download_url,
        })

    # GIF
    try:
        total_pixels = int(out_w) * int(out_h) * int(total_frames)
    except Exception:
        total_pixels = 0
    if total_pixels and total_pixels > MAX_EXPORT_GIF_TOTAL_PIXELS:
        return JsonResponse({
            'ok': False,
            'error': 'gif_too_large',
            'message': 'The GIF is too large to generate. Try reducing the resolution or frame count, or export a PNG sequence instead.',
            'limits': {'max_total_pixels': MAX_EXPORT_GIF_TOTAL_PIXELS},
        }, status=413)

    images = []
    try:
        for frame in frames:
            rgba = _load_frame_rgba(frame, fallback_size=source_size)
            fitted = _fit_to_exact_size(rgba, (out_w, out_h))
            images.append(fitted)
    except RuntimeError as error:
        return JsonResponse({'ok': False, 'error': 'export_unavailable', 'message': str(error)}, status=500)
    except Exception:
        return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Could not prepare frames for export.'}, status=500)

    duration_ms = int(round(1000 / max(1, fps)))
    gif_buffer = io.BytesIO()
    try:
        # Pillow will convert frames to a GIF palette automatically.
        images[0].save(
            gif_buffer,
            format='GIF',
            save_all=True,
            append_images=images[1:],
            duration=duration_ms,
            loop=int(loop_value or 0),
            optimize=True,
            disposal=2,
        )
    except Exception:
        return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Could not generate the GIF.'}, status=500)

    gif_bytes = gif_buffer.getvalue()
    if len(gif_bytes) > MAX_EXPORT_GIF_BYTES:
        return JsonResponse({
            'ok': False,
            'error': 'gif_too_large',
            'message': 'The GIF is too large. Try reducing the resolution or FPS, or export a PNG sequence instead.',
            'limits': {'max_gif_bytes': MAX_EXPORT_GIF_BYTES},
        }, status=413)

    filename = f'{safe_title}_{out_w}x{out_h}_{fps}fps.gif'
    abs_path = os.path.join(abs_dir, filename)
    with open(abs_path, 'wb') as f:
        f.write(gif_bytes)

    rel_path = f'{rel_dir}/{filename}'
    token = _build_export_token(request.user.id, project.pk, rel_path)
    download_url = reverse('animation:project_export_download', kwargs={'pk': project.pk, 'token': token})
    return JsonResponse({
        'ok': True,
        'format': 'gif',
        'filename': filename,
        'download_url': download_url,
    })


@login_required
@require_http_methods(["GET"])
def project_export_download(request, pk, token):
    project = get_accessible_project_or_404(request.user, pk)

    try:
        data = _decode_export_token(token, EXPORT_TOKEN_MAX_AGE_SECONDS)
    except signing.SignatureExpired:
        raise Http404('The export link has expired.')
    except signing.BadSignature:
        raise Http404('Invalid link.')

    if not isinstance(data, dict):
        raise Http404('Invalid link.')
    if int(data.get('u') or 0) != int(request.user.id):
        raise Http404('Access denied.')
    if int(data.get('p') or 0) != int(project.pk):
        raise Http404('Access denied.')

    rel_path = data.get('path')
    abs_path = _safe_media_path(rel_path)
    if not abs_path or not os.path.isfile(abs_path):
        raise Http404('File not found.')

    content_type, _ = mimetypes.guess_type(abs_path)
    if not content_type:
        content_type = 'application/octet-stream'

    filename = os.path.basename(abs_path)
    return FileResponse(open(abs_path, 'rb'), as_attachment=True, filename=filename, content_type=content_type)
