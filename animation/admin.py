from django.contrib import admin
from .models import AnimationProject, Frame, FrameLock, Layer, LayerLock, ProjectPresenceSession


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
    list_display = ('id', 'project', 'index', 'content_revision', 'created_at')
    list_filter = ('project',)


@admin.register(Layer)
class LayerAdmin(admin.ModelAdmin):
    list_display = ('id', 'frame', 'name', 'order', 'content_revision', 'visible', 'opacity')
    list_filter = ('frame__project', 'visible')
    search_fields = ('name', 'frame__project__title')


@admin.register(ProjectPresenceSession)
class ProjectPresenceSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'user', 'role', 'current_frame', 'is_active', 'last_seen_at')
    list_filter = ('project', 'role', 'is_active')
    search_fields = ('user__email', 'user__display_name', 'channel_name', 'project__title')


@admin.register(FrameLock)
class FrameLockAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'frame', 'user', 'presence_session', 'last_heartbeat_at', 'expires_at')
    list_filter = ('project',)
    search_fields = ('user__email', 'user__display_name', 'project__title', 'frame__id')


@admin.register(LayerLock)
class LayerLockAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'frame', 'layer', 'user', 'presence_session', 'last_heartbeat_at', 'expires_at')
    list_filter = ('project', 'frame')
    search_fields = ('user__email', 'user__display_name', 'project__title', 'layer__name')
