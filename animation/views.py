import base64
import io
import json
import mimetypes
import os
import zipfile
from binascii import Error as BinasciiError

from django.contrib import messages
from django.conf import settings
from django.core.files.base import ContentFile
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


@login_required
def project_list(request):
    projects = AnimationProject.objects.filter(owner=request.user)
    return render(request, 'animation/project_list.html', {
        'projects': projects,
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
                'project': {
                    'id': project.pk,
                    'title': project.title,
                    'width': project.width,
                    'height': project.height,
                    'fps': project.fps,
                    'editor_url': reverse('animation:project_editor', kwargs={'pk': project.pk}),
                    'rename_url': reverse('animation:project_rename', kwargs={'pk': project.pk}),
                    'delete_url': reverse('animation:project_delete', kwargs={'pk': project.pk}),
                },
            })

        return redirect('animation:project_editor', pk=project.pk)

    return render(request, 'animation/project_create.html')


@login_required
def project_editor(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
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
    project.delete()
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

    frames = payload.get('frames')
    if not isinstance(frames, list) or not frames:
        return JsonResponse({'ok': False, 'error': 'no_frames'}, status=400)

    saved_indices = []
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

        Frame.objects.update_or_create(
            project=project,
            index=index,
            defaults={'content_json': content_json},
        )
        saved_indices.append(index)

    if not saved_indices:
        return JsonResponse({'ok': False, 'error': 'no_valid_frames'}, status=400)

    project.save(update_fields=['updated_at'])
    return JsonResponse({'ok': True, 'saved_frames': saved_indices})


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
    else:
        return JsonResponse({'ok': False, 'error': 'invalid_format', 'message': 'Выберите формат экспорта.'}, status=400)

    resolution_key = _normalize_resolution_key(payload.get('resolution'))
    out_w, out_h = _get_export_size(project, resolution_key)

    fps = _parse_int(payload.get('fps'), default_value=int(project.fps), min_value=1, max_value=60)

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

    # Кадры берём из preview_image (они уже слиты на клиенте при сохранении кадра).
    source_size = (int(project.width), int(project.height))

    if export_format == 'png_zip':
        digits = max(4, len(str(total_frames)))
        filename = f'{safe_title}_png_seq_{out_w}x{out_h}_{fps}fps.zip'
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
