from datetime import timedelta
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


def generate_project_invite_token():
    return uuid.uuid4().hex


def default_project_invite_expiry():
    return timezone.now() + timedelta(days=7)


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

    def ensure_owner_membership(self):
        ProjectMember.objects.update_or_create(
            project=self,
            user=self.owner,
            defaults={
                'role': ProjectMember.Role.OWNER,
                'invited_by': None,
                'is_active': True,
            },
        )


class ProjectMember(models.Model):
    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        EDITOR = 'editor', 'Editor'
        VIEWER = 'viewer', 'Viewer'

    project = models.ForeignKey(
        AnimationProject,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_memberships',
    )
    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.VIEWER,
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sent_project_memberships',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'user'],
                name='unique_project_member',
            ),
        ]

    def __str__(self):
        return f'{self.user} in {self.project} ({self.role})'

    def can_edit(self):
        return self.is_active and self.role in {self.Role.OWNER, self.Role.EDITOR}

    def can_view(self):
        return self.is_active and self.role in set(self.Role.values)

    def can_manage_members(self):
        return self.is_active and self.role == self.Role.OWNER


class ProjectInvite(models.Model):
    class Role(models.TextChoices):
        EDITOR = 'editor', 'Editor'
        VIEWER = 'viewer', 'Viewer'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        REVOKED = 'revoked', 'Revoked'
        EXPIRED = 'expired', 'Expired'

    project = models.ForeignKey(
        AnimationProject,
        on_delete=models.CASCADE,
        related_name='invites',
    )
    email = models.EmailField()
    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.VIEWER,
    )
    token = models.CharField(
        max_length=255,
        unique=True,
        default=generate_project_invite_token,
        editable=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_project_invite_expiry)
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='accepted_project_invites',
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_project_invites',
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )

    def __str__(self):
        return f'{self.email} -> {self.project} ({self.role})'

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def is_pending(self):
        return self.status == self.Status.PENDING and not self.is_expired()

    def can_be_accepted_by(self, user):
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        if not getattr(user, 'email', ''):
            return False
        return self.is_pending() and user.email.casefold() == self.email.casefold()


class ProjectComment(models.Model):
    project = models.ForeignKey(
        AnimationProject,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    frame = models.ForeignKey(
        'Frame',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='comments',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_comments',
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='resolved_project_comments',
    )

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(fields=['project', 'created_at'], name='animation_p_project_59979d_idx'),
            models.Index(fields=['project', 'frame', 'created_at'], name='animation_p_project_6b4b56_idx'),
            models.Index(fields=['project', 'is_resolved'], name='animation_p_project_30b060_idx'),
        ]

    def __str__(self):
        return f'{self.project} comment by {self.author}'


class Frame(models.Model):
    project = models.ForeignKey(AnimationProject, on_delete=models.CASCADE, related_name='frames')
    index = models.PositiveIntegerField(verbose_name='Frame number')
    content_json = models.TextField(blank=True, verbose_name='Frame content JSON')
    content_revision = models.PositiveIntegerField(default=0, verbose_name='Frame content revision')
    preview_image = models.ImageField(upload_to='frames/', blank=True, null=True, verbose_name='Frame preview')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created at')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Updated at')

    class Meta:
        ordering = ['project', 'index']
        unique_together = ('project', 'index')

    def __str__(self):
        return f'{self.project.title} - frame {self.index}'


class ProjectPresenceSession(models.Model):
    project = models.ForeignKey(
        AnimationProject,
        on_delete=models.CASCADE,
        related_name='presence_sessions',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_presence_sessions',
    )
    channel_name = models.CharField(max_length=255, unique=True)
    current_frame = models.ForeignKey(
        Frame,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='presence_sessions',
    )
    role = models.CharField(
        max_length=16,
        choices=ProjectMember.Role.choices,
        default=ProjectMember.Role.VIEWER,
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['project', 'is_active', 'last_seen_at']),
            models.Index(fields=['project', 'user', 'is_active']),
        ]

    def __str__(self):
        return f'{self.user} online in {self.project} ({self.channel_name})'


class FrameLock(models.Model):
    project = models.ForeignKey(
        AnimationProject,
        on_delete=models.CASCADE,
        related_name='frame_locks',
    )
    frame = models.OneToOneField(
        Frame,
        on_delete=models.CASCADE,
        related_name='frame_lock',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='frame_locks',
    )
    presence_session = models.ForeignKey(
        ProjectPresenceSession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='frame_locks',
    )
    acquired_at = models.DateTimeField(auto_now_add=True)
    last_heartbeat_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=['project', 'expires_at']),
            models.Index(fields=['project', 'user']),
        ]

    def __str__(self):
        return f'{self.frame} locked by {self.user}'


class Layer(models.Model):
    frame = models.ForeignKey(Frame, on_delete=models.CASCADE, related_name='layers')
    order = models.PositiveIntegerField(default=1, verbose_name='Layer order')
    name = models.CharField(max_length=200, verbose_name='Layer name')
    visible = models.BooleanField(default=True, verbose_name='Visible')
    opacity = models.PositiveSmallIntegerField(default=100, verbose_name='Opacity (0-100)')
    content_revision = models.PositiveIntegerField(default=0, verbose_name='Layer content revision')

    class Meta:
        ordering = ['frame', 'order', 'id']

    def __str__(self):
        return f'{self.frame} — {self.name}'


class LayerLock(models.Model):
    project = models.ForeignKey(
        AnimationProject,
        on_delete=models.CASCADE,
        related_name='layer_locks',
    )
    frame = models.ForeignKey(
        Frame,
        on_delete=models.CASCADE,
        related_name='layer_locks',
    )
    layer = models.OneToOneField(
        Layer,
        on_delete=models.CASCADE,
        related_name='layer_lock',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='layer_locks',
    )
    presence_session = models.ForeignKey(
        ProjectPresenceSession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='layer_locks',
    )
    acquired_at = models.DateTimeField(auto_now_add=True)
    last_heartbeat_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=['project', 'frame', 'expires_at'], name='animation_l_project_0ca8e0_idx'),
            models.Index(fields=['project', 'user'], name='animation_l_project_542477_idx'),
            models.Index(fields=['presence_session', 'expires_at'], name='animation_l_presenc_0acc42_idx'),
        ]

    def __str__(self):
        return f'{self.layer} locked by {self.user}'
