from django.db import models
from django.conf import settings


class AnimationProject(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='animation_projects',
    )
    title = models.CharField(max_length=200, verbose_name='Project title')
    description = models.TextField(blank=True, verbose_name='Description')
    width = models.PositiveIntegerField(default=1280, verbose_name='Canvas width (px)')
    height = models.PositiveIntegerField(default=720, verbose_name='Canvas height (px)')
    fps = models.PositiveIntegerField(default=12, verbose_name='Frames per second')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created at')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Updated at')
    # Audio fields can be added later if needed.

    def __str__(self):
        return self.title


class Frame(models.Model):
    project = models.ForeignKey(AnimationProject, on_delete=models.CASCADE, related_name='frames')
    index = models.PositiveIntegerField(verbose_name='Frame number')
    content_json = models.TextField(blank=True, verbose_name='Frame content JSON')
    preview_image = models.ImageField(upload_to='frames/', blank=True, null=True, verbose_name='Frame preview')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created at')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Updated at')

    class Meta:
        ordering = ['project', 'index']
        unique_together = ('project', 'index')

    def __str__(self):
        return f'{self.project.title} - frame {self.index}'


class Layer(models.Model):
    frame = models.ForeignKey(Frame, on_delete=models.CASCADE, related_name='layers')
    order = models.PositiveIntegerField(default=1, verbose_name='Layer order')
    name = models.CharField(max_length=200, verbose_name='Layer name')
    visible = models.BooleanField(default=True, verbose_name='Visible')
    opacity = models.PositiveSmallIntegerField(default=100, verbose_name='Opacity (0-100)')

    class Meta:
        ordering = ['frame', 'order', 'id']

    def __str__(self):
        return f'{self.frame} — {self.name}'
