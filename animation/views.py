import base64
import json
from binascii import Error as BinasciiError

from django.contrib import messages
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Max
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST, require_http_methods
from .models import AnimationProject, Frame, Layer

MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024


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
