from pathlib import Path

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


def project_main_audio_upload_to(instance, filename):
    extension = Path(filename or '').suffix.lower() or '.bin'
    timestamp = timezone.now().strftime('%Y%m%d%H%M%S%f')
    project_id = instance.pk or 'new'
    return f'projects/project_{project_id}/audio/main_audio_{timestamp}{extension}'


class AnimationProject(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='animation_projects')
    title = models.CharField(max_length=200, verbose_name='Название проекта')
    description = models.TextField(blank=True, verbose_name='Описание')
    width = models.PositiveIntegerField(default=1280, verbose_name='Ширина холста (px)')
    height = models.PositiveIntegerField(default=720, verbose_name='Высота холста (px)')
    fps = models.PositiveIntegerField(default=12, verbose_name='Кадров в секунду')
    main_audio = models.FileField(
        upload_to=project_main_audio_upload_to,
        blank=True,
        null=True,
        verbose_name='Основная аудиодорожка',
    )
    main_audio_duration = models.FloatField(
        blank=True,
        null=True,
        verbose_name='Длительность аудио (секунды)',
    )
    main_audio_segments = models.JSONField(default=list, blank=True, verbose_name='Сегменты аудио')
    main_audio_start_frame = models.PositiveIntegerField(default=1, verbose_name='Стартовый кадр аудио')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')

    def __str__(self):
        return self.title


class Frame(models.Model):
    project = models.ForeignKey(AnimationProject, on_delete=models.CASCADE, related_name='frames')
    index = models.PositiveIntegerField(verbose_name='Номер кадра')
    content_json = models.TextField(blank=True, verbose_name='JSON содержимого кадра')
    preview_image = models.ImageField(upload_to='frames/', blank=True, null=True, verbose_name='Превью кадра')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')

    class Meta:
        ordering = ['project', 'index']
        unique_together = ('project', 'index')

    def __str__(self):
        return f'{self.project.title} — кадр {self.index}'


class Layer(models.Model):
    frame = models.ForeignKey(Frame, on_delete=models.CASCADE, related_name='layers')
    order = models.PositiveIntegerField(default=1, verbose_name='Порядок слоя')
    name = models.CharField(max_length=200, verbose_name='Название слоя')
    visible = models.BooleanField(default=True, verbose_name='Видим')
    opacity = models.PositiveSmallIntegerField(default=100, verbose_name='Прозрачность (0-100)')

    class Meta:
        ordering = ['frame', 'order', 'id']

    def __str__(self):
        return f'{self.frame} — {self.name}'
