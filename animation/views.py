import base64
import io
import json
import math
import mimetypes
import os
import subprocess
import tempfile
import uuid
import wave
import zipfile
from binascii import Error as BinasciiError

from django.contrib import messages
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core import signing
from django.db import transaction
from django.db.models import Max
from django.http import JsonResponse, FileResponse, Http404
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST, require_http_methods
from .models import AnimationProject, Frame, Layer

MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024
MAX_EXPORT_GIF_BYTES = 50 * 1024 * 1024
MAX_EXPORT_GIF_FRAMES = 250
MAX_EXPORT_GIF_TOTAL_PIXELS = 200_000_000
MAX_EXPORT_PNG_ZIP_FRAMES = 2000
EXPORT_TOKEN_MAX_AGE_SECONDS = 60 * 60  # 1 час
EXPORT_SIGNING_SALT = 'animstudio.export'
EXPORT_BASE_DIR = 'exports'
DEFAULT_AUDIO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024


def serialize_layer(layer):
    return {
        'id': layer.pk,
        'order': layer.order,
        'name': layer.name,
        'visible': layer.visible,
        'opacity': layer.opacity,
    }


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
        'has_preview': bool(preview_url),
    }


def serialize_project_card(project, first_frame=None):
    frame_payload = serialize_frame(first_frame) if first_frame else {
        'preview_url': '',
        'updated_at': project.updated_at.isoformat() if project.updated_at else '',
        'has_preview': False,
    }
    return {
        'id': project.pk,
        'title': project.title,
        'width': project.width,
        'height': project.height,
        'fps': project.fps,
        'updated_at': project.updated_at.isoformat() if project.updated_at else '',
        'preview_url': frame_payload.get('preview_url', ''),
        'has_preview': frame_payload.get('has_preview', False),
        'editor_url': reverse('animation:project_editor', kwargs={'pk': project.pk}),
        'rename_url': reverse('animation:project_rename', kwargs={'pk': project.pk}),
        'delete_url': reverse('animation:project_delete', kwargs={'pk': project.pk}),
    }


def _make_audio_segment_id():
    return uuid.uuid4().hex


def _parse_float(value, default_value=None, min_value=None, max_value=None):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default_value
    if min_value is not None:
        parsed = max(min_value, parsed)
    if max_value is not None:
        parsed = min(max_value, parsed)
    return parsed


def _build_default_audio_segments(project, start_frame=None):
    if not project.main_audio:
        return []

    duration_seconds = _parse_float(project.main_audio_duration, default_value=0.0, min_value=0.0) or 0.0
    if duration_seconds <= 0:
        return []

    safe_fps = max(1, int(project.fps or 1))
    segment_start_frame = max(1, int(start_frame or project.main_audio_start_frame or 1))
    frame_length = max(1, int(round(duration_seconds * safe_fps)))
    return [{
        'id': _make_audio_segment_id(),
        'start_frame': segment_start_frame,
        'frame_length': frame_length,
        'source_start_seconds': 0.0,
        'source_duration_seconds': round(duration_seconds, 6),
        'row': 0,
        'file_name': project.main_audio.name,
        'filename': os.path.basename(project.main_audio.name),
        'duration_seconds': round(duration_seconds, 6),
    }]


def _assign_audio_segment_rows(segments):
    sorted_segments = sorted(
        segments,
        key=lambda segment: (int(segment['start_frame']), int(segment.get('row', 0)), str(segment['id'])),
    )
    row_end_frames = []
    assigned = []
    for segment in sorted_segments:
        assigned_row = 0
        while assigned_row < len(row_end_frames) and int(segment['start_frame']) < row_end_frames[assigned_row]:
            assigned_row += 1
        row_end_frames[assigned_row:assigned_row + 1] = [int(segment['start_frame']) + int(segment['frame_length'])]
        assigned.append({
            **segment,
            'row': assigned_row,
        })
    return assigned


def _normalize_audio_segments(project, raw_segments=None, fallback_to_default=True):
    segments_source = raw_segments
    if segments_source is None:
        segments_source = project.main_audio_segments
    if not project.main_audio and not segments_source:
        return []
    if not isinstance(segments_source, list):
        segments_source = []

    total_audio_duration = _parse_float(project.main_audio_duration, default_value=0.0, min_value=0.0) or 0.0
    normalized = []

    for item in segments_source:
        if not isinstance(item, dict):
            continue

        segment_id = str(item.get('id') or '').strip() or _make_audio_segment_id()
        start_frame = _parse_int(item.get('start_frame'), default_value=None, min_value=1, max_value=1_000_000)
        frame_length = _parse_int(item.get('frame_length'), default_value=None, min_value=1, max_value=1_000_000)
        source_start_seconds = _parse_float(item.get('source_start_seconds'), default_value=None, min_value=0.0)
        source_duration_seconds = _parse_float(item.get('source_duration_seconds'), default_value=None, min_value=0.001)
        file_name = (item.get('file_name') or '').strip()
        if not file_name and project.main_audio:
            file_name = project.main_audio.name
        filename = (item.get('filename') or '').strip() or os.path.basename(file_name)
        clip_duration_seconds = _parse_float(item.get('duration_seconds'), default_value=None, min_value=0.001)

        if (
            start_frame is None
            or frame_length is None
            or source_start_seconds is None
            or source_duration_seconds is None
            or not file_name
        ):
            continue

        file_total_duration = clip_duration_seconds
        if file_total_duration is None and project.main_audio and file_name == project.main_audio.name:
            file_total_duration = total_audio_duration if total_audio_duration > 0 else None
        if file_total_duration is None:
            file_total_duration = max(source_start_seconds + source_duration_seconds, source_duration_seconds)

        if file_total_duration > 0:
            if source_start_seconds >= file_total_duration:
                continue
            max_duration = max(0.001, file_total_duration - source_start_seconds)
            source_duration_seconds = min(source_duration_seconds, max_duration)

        normalized.append({
            'id': segment_id,
            'start_frame': int(start_frame),
            'frame_length': int(frame_length),
            'source_start_seconds': round(float(source_start_seconds), 6),
            'source_duration_seconds': round(float(source_duration_seconds), 6),
            'row': max(0, _parse_int(item.get('row'), default_value=0, min_value=0, max_value=10_000) or 0),
            'file_name': file_name,
            'filename': filename,
            'duration_seconds': round(float(file_total_duration), 6),
        })

    if normalized:
        return _assign_audio_segment_rows(normalized)
    if fallback_to_default:
        return _build_default_audio_segments(project)
    return []


def serialize_project_audio(project):
    audio_url = ''
    if project.main_audio:
        try:
            audio_url = project.main_audio.url
        except Exception:
            audio_url = ''
    segments = _normalize_audio_segments(project)
    start_frame = segments[0]['start_frame'] if segments else max(1, int(project.main_audio_start_frame or 1))
    serialized_segments = []
    for segment in segments:
        segment_url = ''
        try:
            segment_url = default_storage.url(segment['file_name'])
        except Exception:
            segment_url = ''
        segment_filename = segment.get('filename') or os.path.basename(segment.get('file_name') or '') or os.path.basename(segment_url or '')
        serialized_segments.append({
            **segment,
            'filename': segment_filename,
            'audio_url': segment_url,
        })
    if not audio_url and serialized_segments:
        audio_url = serialized_segments[0].get('audio_url') or ''
    top_level_filename = os.path.basename(project.main_audio.name) if project.main_audio else ''
    if not top_level_filename and serialized_segments:
        top_level_filename = serialized_segments[0].get('filename') or ''
    top_level_duration = float(project.main_audio_duration) if project.main_audio_duration is not None else None
    if top_level_duration is None and serialized_segments:
        top_level_duration = _parse_float(serialized_segments[0].get('duration_seconds'), default_value=None, min_value=0.001)
    return {
        'has_audio': bool(serialized_segments),
        'url': audio_url,
        'filename': top_level_filename,
        'duration_seconds': top_level_duration,
        'start_frame': start_frame,
        'segments': serialized_segments,
        'segments_json': json.dumps(serialized_segments, ensure_ascii=False),
    }


def ensure_default_layer(frame):
    if frame.layers.exists():
        return
    Layer.objects.create(
        frame=frame,
        order=1,
        name='Фон',
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

    # уникальность (project, index) — чтобы не словить конфликты при смене индексов,
    # сначала уводим индексы во временную область, затем выставляем 1..N.
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

    # возвращаем уже в правильном порядке
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


def _get_audio_upload_max_bytes():
    return int(getattr(settings, 'ANIMATION_AUDIO_MAX_UPLOAD_BYTES', DEFAULT_AUDIO_UPLOAD_MAX_BYTES))


def _get_audio_allowed_extensions():
    raw_value = getattr(settings, 'ANIMATION_AUDIO_ALLOWED_EXTENSIONS', ('mp3', 'wav'))
    normalized = set()
    for item in raw_value:
        if not item:
            continue
        item = str(item).strip().lower()
        if not item:
            continue
        normalized.add(item if item.startswith('.') else f'.{item}')
    return normalized or {'.mp3', '.wav'}


def _get_project_audio_segments(project):
    return _normalize_audio_segments(project)


def _build_uploaded_audio_storage_name(project_id, original_name):
    extension = os.path.splitext(original_name or '')[1].lower() or '.bin'
    return f'projects/project_{project_id}/audio/clip_{uuid.uuid4().hex}{extension}'


def _get_stored_audio_abs_path(file_name):
    if not file_name:
        return ''
    try:
        return default_storage.path(file_name)
    except Exception:
        return os.path.join(settings.MEDIA_ROOT, file_name)


def _import_moviepy_exports():
    try:
        from moviepy import AudioFileClip, CompositeAudioClip, ImageSequenceClip  # pylint: disable=import-outside-toplevel
        return AudioFileClip, CompositeAudioClip, ImageSequenceClip
    except Exception:
        try:
            from moviepy.editor import AudioFileClip, CompositeAudioClip, ImageSequenceClip  # pylint: disable=import-outside-toplevel
            return AudioFileClip, CompositeAudioClip, ImageSequenceClip
        except Exception as exc:
            raise RuntimeError('Для работы с аудио и MP4 установите пакет moviepy.') from exc


def _close_clip_safely(clip):
    close_method = getattr(clip, 'close', None)
    if callable(close_method):
        try:
            close_method()
        except Exception:
            pass


def _clip_with_start(clip, start_seconds):
    if start_seconds <= 0:
        return clip
    if hasattr(clip, 'with_start'):
        return clip.with_start(start_seconds)
    if hasattr(clip, 'set_start'):
        return clip.set_start(start_seconds)
    return clip


def _clip_with_audio(video_clip, audio_clip):
    if hasattr(video_clip, 'with_audio'):
        return video_clip.with_audio(audio_clip)
    if hasattr(video_clip, 'set_audio'):
        return video_clip.set_audio(audio_clip)
    return video_clip


def _clip_trim(clip, end_seconds):
    if end_seconds <= 0:
        return clip
    clip_duration = float(getattr(clip, 'duration', 0) or 0)
    if clip_duration > 0:
        safe_end_seconds = min(float(end_seconds), clip_duration)
        if safe_end_seconds <= 0:
            return clip
        # small tolerance for ffmpeg rounding
        if safe_end_seconds > clip_duration - 1e-3:
            safe_end_seconds = max(0.0, clip_duration - 1e-3)
        if safe_end_seconds <= 0:
            safe_end_seconds = clip_duration
    else:
        safe_end_seconds = float(end_seconds)
    if hasattr(clip, 'subclipped'):
        return clip.subclipped(0, safe_end_seconds)
    if hasattr(clip, 'subclip'):
        return clip.subclip(0, safe_end_seconds)
    return clip


def _clip_extract_range(clip, start_seconds, end_seconds):
    if hasattr(clip, 'subclipped'):
        return clip.subclipped(start_seconds, end_seconds)
    if hasattr(clip, 'subclip'):
        return clip.subclip(start_seconds, end_seconds)
    return clip


def _get_audio_duration_seconds(audio_path):
    if not audio_path or not os.path.exists(audio_path):
        return None

    extension = os.path.splitext(audio_path)[1].lower()
    if extension == '.wav':
        try:
            with wave.open(audio_path, 'rb') as wav_file:
                frame_count = wav_file.getnframes()
                frame_rate = wav_file.getframerate() or 1
                duration = frame_count / float(frame_rate)
                return round(duration, 3)
        except Exception:
            pass

    try:
        AudioFileClip, _, _ = _import_moviepy_exports()
    except RuntimeError:
        return None

    clip = None
    try:
        clip = AudioFileClip(audio_path)
        duration = float(getattr(clip, 'duration', 0) or 0)
        return round(duration, 3) if duration > 0 else None
    finally:
        _close_clip_safely(clip)


@login_required
def project_list(request):
    projects = AnimationProject.objects.filter(owner=request.user).prefetch_related('frames').order_by('-updated_at')
    project_cards = []
    for project in projects:
        frames = list(project.frames.all())
        first_frame = frames[0] if frames else None
        project_cards.append(serialize_project_card(project, first_frame))
    return render(request, 'animation/project_list.html', {
        'project_cards': project_cards,
    })


@login_required
def project_create(request):
    if request.method == 'POST':
        is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
        title = (request.POST.get('title') or '').strip() or 'Новый проект'

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

        # сразу создаём первый пустой кадр и фон
        frame = Frame.objects.create(project=project, index=1)
        ensure_default_layer(frame)

        if is_ajax:
            return JsonResponse({
                'ok': True,
                'project': serialize_project_card(project, frame),
            })

        return redirect('animation:project_editor', pk=project.pk)

    return render(request, 'animation/project_create.html')


@login_required
def project_editor(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    first_frame = project.frames.order_by('index').first()
    project_audio = serialize_project_audio(project)
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
        'project_audio': project_audio,
        'current_frame_index': current_frame_index,
        'current_frame_preview_url': current_frame_preview_url,
        'current_frame_updated_at': current_frame_updated_at,
    })


@login_required
def project_rename(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'

    if request.method == 'POST':
        posted_id = request.POST.get('project_id')
        if posted_id and str(project.pk) != posted_id:
            if is_ajax:
                return JsonResponse({'ok': False, 'error': 'invalid_project'}, status=400)
            messages.error(request, 'Некорректный проект.')
            return redirect('animation:project_list')

        new_title = (request.POST.get('new_title') or '').strip()
        if not new_title:
            if is_ajax:
                return JsonResponse({'ok': False, 'error': 'empty_title'}, status=400)
            messages.error(request, 'Название не может быть пустым.')
            return redirect('animation:project_list')

        project.title = new_title
        project.save(update_fields=['title'])
        if is_ajax:
            return JsonResponse({
                'ok': True,
                'project_id': project.pk,
                'title': project.title,
            })
        messages.success(request, 'Название проекта обновлено.')
        return redirect('animation:project_list')

    return render(request, 'animation/project_rename.html', {
        'project': project,
    })


@login_required
@require_POST
def project_delete(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
    project_title = project.title
    audio_storage = project.main_audio.storage if project.main_audio else None
    audio_name = project.main_audio.name if project.main_audio else ''
    project.delete()
    if audio_storage and audio_name:
        try:
            audio_storage.delete(audio_name)
        except Exception:
            pass
    if is_ajax:
        return JsonResponse({
            'ok': True,
            'project_id': pk,
            'title': project_title,
        })
    messages.success(request, f'Проект «{project_title}» удалён.')
    return redirect('animation:project_list')


@login_required
@require_POST
def project_save(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    raw_frames = payload.get('frames', [])
    if raw_frames is None:
        raw_frames = []
    if not isinstance(raw_frames, list):
        return JsonResponse({'ok': False, 'error': 'invalid_frames'}, status=400)

    has_audio_segments = 'main_audio_segments' in payload
    if has_audio_segments and not isinstance(payload.get('main_audio_segments'), list):
        return JsonResponse({'ok': False, 'error': 'invalid_audio_segments'}, status=400)

    saved_indices = []
    for frame_data in raw_frames:
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

        Frame.objects.update_or_create(
            project=project,
            index=index,
            defaults={'content_json': content_json},
        )
        saved_indices.append(index)

    update_fields = []
    if has_audio_segments:
        normalized_segments = _normalize_audio_segments(
            project,
            payload.get('main_audio_segments'),
            fallback_to_default=False,
        )
        project.main_audio_segments = normalized_segments
        project.main_audio_start_frame = normalized_segments[0]['start_frame'] if normalized_segments else 1
        update_fields.extend(['main_audio_segments', 'main_audio_start_frame'])

    if not saved_indices and not has_audio_segments:
        return JsonResponse({'ok': False, 'error': 'no_project_changes'}, status=400)

    project.save(update_fields=[*update_fields, 'updated_at'])
    return JsonResponse({
        'ok': True,
        'saved_frames': saved_indices,
        'audio': serialize_project_audio(project),
        'updated_at': project.updated_at.isoformat() if project.updated_at else '',
    })


@login_required
@require_POST
def project_update(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'invalid_payload'}, status=400)

    update_fields = []

    if 'fps' in payload:
        fps = _parse_int(payload.get('fps'), default_value=None, min_value=1, max_value=60)
        if fps is None:
            return JsonResponse({'ok': False, 'error': 'invalid_fps'}, status=400)
        project.fps = fps
        update_fields.append('fps')

    if 'main_audio_segments' in payload:
        raw_segments = payload.get('main_audio_segments')
        if raw_segments is not None and not isinstance(raw_segments, list):
            return JsonResponse({'ok': False, 'error': 'invalid_audio_segments'}, status=400)
        normalized_segments = _normalize_audio_segments(project, raw_segments, fallback_to_default=False)
        project.main_audio_segments = normalized_segments
        project.main_audio_start_frame = normalized_segments[0]['start_frame'] if normalized_segments else 1
        update_fields.extend(['main_audio_segments', 'main_audio_start_frame'])

    has_audio_start_frame = 'main_audio_start_frame' in payload or 'audio_start_frame' in payload
    if has_audio_start_frame and 'main_audio_segments' not in payload:
        audio_start_frame = _parse_int(
            payload.get('main_audio_start_frame', payload.get('audio_start_frame')),
            default_value=None,
            min_value=1,
            max_value=1_000_000,
        )
        if audio_start_frame is None:
            return JsonResponse({'ok': False, 'error': 'invalid_audio_start_frame'}, status=400)
        segments = _get_project_audio_segments(project)
        if segments:
            current_first_frame = segments[0]['start_frame']
            frame_delta = audio_start_frame - current_first_frame
            if frame_delta:
                shifted_segments = []
                min_shifted_start = min(segment['start_frame'] + frame_delta for segment in segments)
                corrective_delta = 1 - min_shifted_start if min_shifted_start < 1 else 0
                for segment in segments:
                    shifted_segments.append({
                        **segment,
                        'start_frame': segment['start_frame'] + frame_delta + corrective_delta,
                    })
                project.main_audio_segments = shifted_segments
                update_fields.append('main_audio_segments')
        project.main_audio_start_frame = audio_start_frame
        update_fields.append('main_audio_start_frame')

    if not update_fields:
        return JsonResponse({'ok': False, 'error': 'no_changes'}, status=400)

    project.save(update_fields=[*update_fields, 'updated_at'])

    return JsonResponse({
        'ok': True,
        'project': {
            'id': project.pk,
            'fps': project.fps,
            'audio': serialize_project_audio(project),
            'updated_at': project.updated_at.isoformat() if project.updated_at else '',
        },
    })


@login_required
@require_POST
def project_audio_upload(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return JsonResponse({'ok': False, 'error': 'audio_required', 'message': 'Выберите аудиофайл.'}, status=400)

    max_bytes = _get_audio_upload_max_bytes()
    if audio_file.size and int(audio_file.size) > max_bytes:
        max_megabytes = max_bytes / (1024 * 1024)
        return JsonResponse({
            'ok': False,
            'error': 'file_too_large',
            'message': f'Размер аудиофайла превышает {max_megabytes:.0f} МБ.',
            'limits': {'max_audio_bytes': max_bytes},
        }, status=413)

    extension = os.path.splitext(audio_file.name or '')[1].lower()
    if extension not in _get_audio_allowed_extensions():
        return JsonResponse({
            'ok': False,
            'error': 'invalid_audio_format',
            'message': 'Поддерживаются только файлы MP3 и WAV.',
        }, status=400)

    content_type = (audio_file.content_type or mimetypes.guess_type(audio_file.name or '')[0] or '').lower()
    if content_type and not (content_type.startswith('audio/') or content_type == 'application/octet-stream'):
        return JsonResponse({
            'ok': False,
            'error': 'invalid_audio_content_type',
            'message': 'Файл не похож на аудио.',
        }, status=400)

    start_frame = _parse_int(
        request.POST.get('start_frame'),
        default_value=max(1, int(request.POST.get('start_frame') or project.main_audio_start_frame or 1)),
        min_value=1,
        max_value=1_000_000,
    )
    storage_name = default_storage.save(_build_uploaded_audio_storage_name(project.pk, audio_file.name), audio_file)
    duration_seconds = _get_audio_duration_seconds(_get_stored_audio_abs_path(storage_name))
    if duration_seconds is None:
        duration_seconds = 0.0

    existing_segments = _get_project_audio_segments(project)
    new_segment = {
        'id': _make_audio_segment_id(),
        'start_frame': start_frame,
        'frame_length': max(1, int(round(max(duration_seconds, 0.001) * max(1, int(project.fps or 1))))),
        'source_start_seconds': 0.0,
        'source_duration_seconds': round(max(duration_seconds, 0.001), 6),
        'row': 0,
        'file_name': storage_name,
        'filename': os.path.basename(audio_file.name or storage_name),
        'duration_seconds': round(max(duration_seconds, 0.001), 6),
    }
    project.main_audio_segments = _normalize_audio_segments(
        project,
        [*existing_segments, new_segment],
        fallback_to_default=False,
    )
    if project.main_audio_segments:
        project.main_audio_start_frame = project.main_audio_segments[0]['start_frame']
    project.save(update_fields=['main_audio_segments', 'main_audio_start_frame', 'updated_at'])

    return JsonResponse({
        'ok': True,
        'audio': serialize_project_audio(project),
        'selected_segment_id': new_segment['id'],
    })


@login_required
@require_http_methods(["GET", "DELETE"])
def project_audio_detail(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)

    if request.method == 'GET':
        return JsonResponse({
            'ok': True,
            'audio': serialize_project_audio(project),
        })

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        payload = {}
    clip_id = str(payload.get('clip_id') or '').strip()
    if not clip_id:
        return JsonResponse({'ok': False, 'error': 'clip_id_required', 'message': 'Не выбран аудиоклип.'}, status=400)

    segments = _get_project_audio_segments(project)
    removed_segment = None
    remaining_segments = []
    for segment in segments:
        if str(segment.get('id')) == clip_id and removed_segment is None:
            removed_segment = segment
            continue
        remaining_segments.append(segment)

    if removed_segment is None:
        return JsonResponse({'ok': False, 'error': 'clip_not_found', 'message': 'Аудиоклип не найден.'}, status=404)

    removed_file_name = removed_segment.get('file_name') or ''
    project.main_audio_segments = _normalize_audio_segments(project, remaining_segments, fallback_to_default=False)
    project.main_audio_start_frame = project.main_audio_segments[0]['start_frame'] if project.main_audio_segments else 1

    update_fields = ['main_audio_segments', 'main_audio_start_frame', 'updated_at']
    if project.main_audio and removed_file_name and removed_file_name == project.main_audio.name:
        still_used_legacy_file = any(item.get('file_name') == removed_file_name for item in project.main_audio_segments)
        if not still_used_legacy_file:
            audio_storage = project.main_audio.storage
            audio_name = project.main_audio.name
            project.main_audio = None
            project.main_audio_duration = None
            update_fields.extend(['main_audio', 'main_audio_duration'])
            try:
                audio_storage.delete(audio_name)
            except Exception:
                pass
    project.save(update_fields=update_fields)

    if removed_file_name and removed_file_name != (project.main_audio.name if project.main_audio else ''):
        still_used_file = any(item.get('file_name') == removed_file_name for item in project.main_audio_segments)
        if not still_used_file:
            try:
                default_storage.delete(removed_file_name)
            except Exception:
                pass

    return JsonResponse({
        'ok': True,
        'audio': serialize_project_audio(project),
        'deleted_segment_id': clip_id,
    })


@login_required
@require_http_methods(["GET"])
def frames_list(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    frames = project.frames.order_by('index', 'id')
    return JsonResponse({
        'ok': True,
        'frames': [serialize_frame(frame) for frame in frames],
    })


@login_required
@require_http_methods(["GET"])
def frame_detail(request, pk, index):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
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
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)

    duplicate_from_index = payload.get('duplicate_from_index')
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

                # копируем превью (файл) если оно есть
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

                # копируем слои (метаданные)
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

    frames = project.frames.order_by('index', 'id')
    return JsonResponse({
        'ok': True,
        'active_index': new_frame.index,
        'frame': serialize_frame(new_frame),
        'frames': [serialize_frame(frame) for frame in frames],
    })


@login_required
@require_POST
def frame_delete(request, pk, index):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    frame = get_object_or_404(Frame, project=project, index=index)

    with transaction.atomic():
        frame.delete()

        # если это был последний кадр — создаём новый пустой, чтобы проект не остался без кадров
        if project.frames.count() == 0:
            new_frame = Frame.objects.create(project=project, index=1)
            ensure_default_layer(new_frame)
            frames = [new_frame]
        else:
            frames = renumber_frames(project)
        project.save(update_fields=['updated_at'])

    # ближайший кадр: по позиции (после перенумерации)
    next_total = len(frames)
    next_active_index = min(max(1, index), next_total) if next_total else 1

    return JsonResponse({
        'ok': True,
        'active_index': next_active_index,
        'frames': [serialize_frame(item) for item in frames],
    })


@login_required
@require_POST
def frame_reorder(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)

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

    return JsonResponse({
        'ok': True,
        'frames': [serialize_frame(item) for item in frames],
    })


@login_required
@require_POST
def frame_save(request, pk, index):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    frame = get_object_or_404(Frame, project=project, index=index)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Некорректный JSON.'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'Некорректный формат данных.'}, status=400)

    image_data = payload.get('image_data')
    content_json = payload.get('content_json')

    if isinstance(image_data, str):
        image_data = image_data.strip()
        if not image_data:
            image_data = None

    if image_data is None and content_json is None:
        return JsonResponse({'ok': False, 'error': 'Нет данных для сохранения.'}, status=400)

    if image_data is not None:
        if not isinstance(image_data, str):
            return JsonResponse({'ok': False, 'error': 'Некорректные данные изображения.'}, status=400)

        header = ''
        encoded = image_data
        if image_data.startswith('data:'):
            try:
                header, encoded = image_data.split(',', 1)
            except ValueError:
                return JsonResponse({'ok': False, 'error': 'Некорректные данные изображения.'}, status=400)
            encoded = encoded.strip()

        try:
            decoded = base64.b64decode(encoded, validate=True)
        except (BinasciiError, ValueError):
            return JsonResponse({'ok': False, 'error': 'Некорректные данные изображения.'}, status=400)

        if not decoded:
            return JsonResponse({'ok': False, 'error': 'Пустое изображение.'}, status=400)

        if len(decoded) > MAX_PREVIEW_IMAGE_BYTES:
            max_mb = MAX_PREVIEW_IMAGE_BYTES // (1024 * 1024)
            return JsonResponse({
                'ok': False,
                'error': f'Изображение слишком большое. Максимум {max_mb} МБ.',
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

        filename = f'project_{project.pk}_frame_{frame.index}.{extension}'
        frame.preview_image.save(filename, ContentFile(decoded), save=False)

    if content_json is not None:
        if isinstance(content_json, str):
            frame.content_json = content_json
        else:
            try:
                frame.content_json = json.dumps(content_json, ensure_ascii=False)
            except (TypeError, ValueError):
                return JsonResponse({'ok': False, 'error': 'Некорректные данные JSON.'}, status=400)

    frame.save()
    project.save(update_fields=['updated_at'])

    return JsonResponse({
        'ok': True,
        'frame': {
            'id': frame.pk,
            'index': frame.index,
            'preview_url': frame.preview_image.url if frame.preview_image else '',
            'updated_at': frame.updated_at.isoformat() if frame.updated_at else '',
        },
    })


@login_required
@require_http_methods(["GET", "POST"])
def frame_layers(request, pk, index):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
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
        name = f'Слой {frame.layers.count() + 1}'

    last_layer = frame.layers.order_by('-order', '-id').first()
    next_order = (last_layer.order if last_layer else 0) + 1
    layer = Layer.objects.create(
        frame=frame,
        order=next_order,
        name=name,
        visible=True,
        opacity=100,
    )
    return JsonResponse({
        'ok': True,
        'layer': serialize_layer(layer),
    })


@login_required
@require_POST
def layer_update(request, pk, index, layer_id):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
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

    return JsonResponse({
        'ok': True,
        'layer': serialize_layer(layer),
    })


@login_required
@require_POST
def layer_delete(request, pk, index, layer_id):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    frame = get_object_or_404(Frame, project=project, index=index)
    layer = get_object_or_404(Layer, frame=frame, pk=layer_id)
    layer.delete()
    ensure_default_layer(frame)
    reorder_layers(frame)
    layers = frame.layers.order_by('order', 'id')
    return JsonResponse({
        'ok': True,
        'layers': [serialize_layer(item) for item in layers],
    })


@login_required
@require_POST
def layer_reorder(request, pk, index):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
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
    return JsonResponse({
        'ok': True,
        'layers': [serialize_layer(layer) for layer in layers],
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


def _get_pillow_resample():
    # Pillow 9+: Image.Resampling.LANCZOS; старые версии: Image.LANCZOS
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
        raise RuntimeError('Pillow не установлен. Установите пакет Pillow для экспорта изображений.') from exc

    width, height = fallback_size
    if frame.preview_image:
        try:
            path = frame.preview_image.path
            with Image.open(path) as im:
                rgba = im.convert('RGBA')
            return rgba
        except Exception:
            # если файл битый/недоступен — возвращаем пустой кадр, но не падаем
            pass
    return Image.new('RGBA', (int(width), int(height)), (0, 0, 0, 0))


def _fit_to_exact_size(image_rgba, out_size):
    try:
        from PIL import Image  # pylint: disable=import-outside-toplevel
    except Exception as exc:
        raise RuntimeError('Pillow не установлен. Установите пакет Pillow для экспорта изображений.') from exc

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


def _build_audio_segment_clip(AudioFileClip, segment, fps, video_duration):
    start_frame = int(segment.get('start_frame') or 1)
    frame_length = max(1, int(segment.get('frame_length') or 1))
    source_start_seconds = max(0.0, float(segment.get('source_start_seconds') or 0.0))
    source_duration_seconds = max(0.001, float(segment.get('source_duration_seconds') or 0.001))
    audio_path = _get_stored_audio_abs_path(segment.get('file_name') or '')
    if not audio_path or not os.path.exists(audio_path):
        return None

    timeline_start_seconds = max(0.0, (start_frame - 1) / float(max(1, fps)))
    timeline_duration_seconds = max(0.001, frame_length / float(max(1, fps)))
    if timeline_start_seconds >= video_duration:
        return None

    remaining_video_duration = max(0.001, video_duration - timeline_start_seconds)
    target_duration_seconds = min(timeline_duration_seconds, remaining_video_duration)
    playback_rate = max(0.01, source_duration_seconds / target_duration_seconds)
    return {
        'audio_path': audio_path,
        'timeline_start_seconds': timeline_start_seconds,
        'target_duration_seconds': target_duration_seconds,
        'source_start_seconds': source_start_seconds,
        'source_duration_seconds': source_duration_seconds,
        'playback_rate': playback_rate,
        'segment_id': str(segment.get('id') or uuid.uuid4().hex),
    }


def _build_ffmpeg_atempo_filter(playback_rate):
    rate = max(0.01, float(playback_rate or 1.0))
    factors = []
    while rate > 2.0:
        factors.append(2.0)
        rate /= 2.0
    while rate < 0.5:
        factors.append(0.5)
        rate /= 0.5
    factors.append(rate)
    return ','.join(f'atempo={factor:.6f}' for factor in factors)


def _render_processed_audio_segment(segment_spec, temp_dir):
    try:
        import imageio_ffmpeg  # pylint: disable=import-outside-toplevel
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        raise RuntimeError('Для качественного аудио-экспорта требуется ffmpeg.') from exc

    output_path = os.path.join(temp_dir, f"segment_{segment_spec['segment_id']}.wav")
    command = [
        ffmpeg_exe,
        '-y',
        '-ss', f"{segment_spec['source_start_seconds']:.6f}",
        '-t', f"{segment_spec['source_duration_seconds']:.6f}",
        '-i', segment_spec['audio_path'],
        '-vn',
    ]
    playback_rate = float(segment_spec['playback_rate'])
    if not math.isclose(playback_rate, 1.0, rel_tol=1e-4, abs_tol=1e-4):
        command.extend(['-filter:a', _build_ffmpeg_atempo_filter(playback_rate)])
    command.extend(['-acodec', 'pcm_s16le', output_path])

    try:
        subprocess.run(command, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        stderr_text = exc.stderr.decode('utf-8', errors='ignore') if exc.stderr else ''
        raise RuntimeError(f'Не удалось обработать аудиосегмент через ffmpeg. {stderr_text}'.strip()) from exc
    return output_path


def _export_mp4_with_audio(abs_path, frames, source_size, out_size, fps, audio_segments):
    AudioFileClip, CompositeAudioClip, ImageSequenceClip = _import_moviepy_exports()
    video_clip = None
    composite_audio_clip = None
    audio_clips = []

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            frame_paths = []
            digits = max(4, len(str(len(frames))))
            for index, frame in enumerate(frames, start=1):
                rgba = _load_frame_rgba(frame, fallback_size=source_size)
                fitted = _fit_to_exact_size(rgba, out_size)
                frame_path = os.path.join(temp_dir, f'frame_{index:0{digits}d}.png')
                fitted.save(frame_path, format='PNG')
                frame_paths.append(frame_path)

            video_clip = ImageSequenceClip(frame_paths, fps=fps)
            video_duration = len(frame_paths) / float(max(1, fps))

            if audio_segments:
                for segment in audio_segments:
                    segment_spec = _build_audio_segment_clip(
                        AudioFileClip=AudioFileClip,
                        segment=segment,
                        fps=fps,
                        video_duration=video_duration,
                    )
                    if segment_spec is None:
                        continue
                    processed_audio_path = _render_processed_audio_segment(segment_spec, temp_dir)
                    segment_clip = AudioFileClip(processed_audio_path)
                    segment_clip = _clip_trim(segment_clip, segment_spec['target_duration_seconds'])
                    segment_clip = _clip_with_start(segment_clip, segment_spec['timeline_start_seconds'])
                    audio_clips.append(segment_clip)
                composite_audio_clip = CompositeAudioClip(audio_clips) if audio_clips else None
            if composite_audio_clip is not None:
                video_clip = _clip_with_audio(video_clip, composite_audio_clip)

            video_clip.write_videofile(
                abs_path,
                fps=fps,
                codec='libx264',
                audio_codec='aac',
                logger=None,
            )
    finally:
        _close_clip_safely(composite_audio_clip)
        for clip in audio_clips:
            _close_clip_safely(clip)
        _close_clip_safely(video_clip)


@login_required
@require_POST
def project_export(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid_json', 'message': 'Некорректный JSON.'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'ok': False, 'error': 'invalid_payload', 'message': 'Некорректный формат данных.'}, status=400)

    export_format = (payload.get('format') or '').strip().lower()
    if export_format in ('png', 'png_zip', 'png-seq', 'png_sequence', 'zip'):
        export_format = 'png_zip'
    elif export_format in ('gif', 'gif_file'):
        export_format = 'gif'
    elif export_format in ('mp4', 'video', 'video_mp4'):
        export_format = 'mp4'
    else:
        return JsonResponse({'ok': False, 'error': 'invalid_format', 'message': 'Выберите формат экспорта.'}, status=400)

    resolution_key = _normalize_resolution_key(payload.get('resolution'))
    out_w, out_h = _get_export_size(project, resolution_key)

    frames_qs = project.frames.order_by('index', 'id')
    frames = list(frames_qs)
    total_frames = len(frames)
    if total_frames <= 0:
        return JsonResponse({'ok': False, 'error': 'no_frames', 'message': 'В проекте нет кадров.'}, status=400)

    if export_format == 'gif' and total_frames > MAX_EXPORT_GIF_FRAMES:
        return JsonResponse({
            'ok': False,
            'error': 'too_many_frames',
            'message': f'Слишком много кадров для GIF ({total_frames}). Рекомендуем экспорт в PNG‑последовательность или уменьшить количество кадров.',
            'limits': {'max_gif_frames': MAX_EXPORT_GIF_FRAMES},
        }, status=413)

    if export_format == 'png_zip' and total_frames > MAX_EXPORT_PNG_ZIP_FRAMES:
        return JsonResponse({
            'ok': False,
            'error': 'too_many_frames',
            'message': f'Слишком много кадров для экспорта ({total_frames}). Уменьшите количество кадров.',
            'limits': {'max_png_zip_frames': MAX_EXPORT_PNG_ZIP_FRAMES},
        }, status=413)

    if export_format == 'mp4' and total_frames > MAX_EXPORT_PNG_ZIP_FRAMES:
        return JsonResponse({
            'ok': False,
            'error': 'too_many_frames',
            'message': f'Слишком много кадров для экспорта MP4 ({total_frames}). Уменьшите количество кадров.',
            'limits': {'max_mp4_frames': MAX_EXPORT_PNG_ZIP_FRAMES},
        }, status=413)

    if export_format == 'gif':
        fps = _parse_int(payload.get('fps'), default_value=int(project.fps), min_value=1, max_value=60)
        loop_infinite = bool(payload.get('loop_infinite', True))
        loop_count = _parse_int(payload.get('loop_count'), default_value=0, min_value=0, max_value=10_000)
        loop_value = 0 if loop_infinite or loop_count == 0 else loop_count
    else:
        fps = int(project.fps)
        loop_value = None

    if export_format == 'mp4':
        audio_payload = serialize_project_audio(project)
        if not audio_payload.get('has_audio'):
            return JsonResponse({
                'ok': False,
                'error': 'audio_required',
                'message': 'Для экспорта MP4 сначала загрузите аудио.',
            }, status=400)

        audio_segments = audio_payload.get('segments') or []
        if not audio_segments:
            return JsonResponse({
                'ok': False,
                'error': 'audio_segments_missing',
                'message': 'На таймлайне нет аудиосегментов для экспорта.',
            }, status=400)
        if not any(
            segment.get('file_name') and os.path.exists(_get_stored_audio_abs_path(segment.get('file_name')))
            for segment in audio_segments
        ):
            return JsonResponse({
                'ok': False,
                'error': 'audio_missing',
                'message': 'Файлы аудио не найдены в хранилище проекта.',
            }, status=500)
    else:
        audio_segments = []

    rel_dir, abs_dir = _ensure_export_dir(request.user.id, project.pk)

    safe_title = (project.title or 'project').strip()
    safe_title = ''.join(ch for ch in safe_title if ch.isalnum() or ch in (' ', '-', '_')).strip() or 'project'
    safe_title = safe_title.replace(' ', '_')

    # Кадры берём из preview_image (они уже слиты на клиенте при сохранении кадра).
    source_size = (int(project.width), int(project.height))

    if export_format == 'mp4':
        filename = f'{safe_title}_{out_w}x{out_h}_{fps}fps.mp4'
        abs_path = os.path.join(abs_dir, filename)
        try:
            _export_mp4_with_audio(
                abs_path=abs_path,
                frames=frames,
                source_size=source_size,
                out_size=(out_w, out_h),
                fps=max(1, int(fps or project.fps or 1)),
                audio_segments=audio_segments,
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
            return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Не удалось сформировать MP4‑файл.'}, status=500)

        rel_path = f'{rel_dir}/{filename}'
        token = _build_export_token(request.user.id, project.pk, rel_path)
        download_url = reverse('animation:project_export_download', kwargs={'pk': project.pk, 'token': token})
        return JsonResponse({
            'ok': True,
            'format': 'mp4',
            'filename': filename,
            'download_url': download_url,
        })

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
            return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Не удалось сформировать ZIP‑архив.'}, status=500)

        rel_path = f'{rel_dir}/{filename}'
        token = _build_export_token(request.user.id, project.pk, rel_path)
        download_url = reverse('animation:project_export_download', kwargs={'pk': project.pk, 'token': token})
        return JsonResponse({
            'ok': True,
            'format': 'png_zip',
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
            'message': 'Слишком тяжёлый GIF для генерации. Попробуйте уменьшить разрешение/количество кадров или экспортировать PNG‑последовательность.',
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
        return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Не удалось подготовить кадры для экспорта.'}, status=500)

    duration_ms = int(round(1000 / max(1, fps)))
    gif_buffer = io.BytesIO()
    try:
        # Pillow сам приведёт кадры к палитре GIF.
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
        return JsonResponse({'ok': False, 'error': 'export_failed', 'message': 'Не удалось сформировать GIF.'}, status=500)

    gif_bytes = gif_buffer.getvalue()
    if len(gif_bytes) > MAX_EXPORT_GIF_BYTES:
        return JsonResponse({
            'ok': False,
            'error': 'gif_too_large',
            'message': 'GIF получился слишком тяжёлым. Попробуйте уменьшить разрешение/FPS или экспортировать PNG‑последовательность.',
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
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)

    try:
        data = _decode_export_token(token, EXPORT_TOKEN_MAX_AGE_SECONDS)
    except signing.SignatureExpired:
        raise Http404('Ссылка на экспорт устарела.')
    except signing.BadSignature:
        raise Http404('Некорректная ссылка.')

    if not isinstance(data, dict):
        raise Http404('Некорректная ссылка.')
    if int(data.get('u') or 0) != int(request.user.id):
        raise Http404('Нет доступа.')
    if int(data.get('p') or 0) != int(project.pk):
        raise Http404('Нет доступа.')

    rel_path = data.get('path')
    abs_path = _safe_media_path(rel_path)
    if not abs_path or not os.path.isfile(abs_path):
        raise Http404('Файл не найден.')

    content_type, _ = mimetypes.guess_type(abs_path)
    if not content_type:
        content_type = 'application/octet-stream'

    filename = os.path.basename(abs_path)
    return FileResponse(open(abs_path, 'rb'), as_attachment=True, filename=filename, content_type=content_type)
