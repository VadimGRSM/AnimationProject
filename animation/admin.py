from django.contrib import admin
from .models import AnimationProject, Frame


class FrameInline(admin.TabularInline):
    model = Frame
    extra = 0


@admin.register(AnimationProject)
class AnimationProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'owner', 'fps', 'created_at')
    list_filter = ('owner',)
    inlines = [FrameInline]


@admin.register(Frame)
class FrameAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'index', 'created_at')
    list_filter = ('project',)
