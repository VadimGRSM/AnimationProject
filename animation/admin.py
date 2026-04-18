from django.contrib import admin
from .models import AnimationProject, Frame, FrameLock, ProjectPresenceSession


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
