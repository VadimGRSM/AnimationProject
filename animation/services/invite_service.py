from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.urls import reverse
from django.utils import timezone

from ..models import ProjectInvite, ProjectMember

PENDING_PROJECT_INVITE_SESSION_KEY = 'pending_project_invite_token'


def normalize_invite_email(email):
    return (email or '').strip().casefold()


def validate_project_invite_email(value):
    email = (value or '').strip()
    if not email:
        raise ValidationError('Email is required.', code='invalid_email')

    validate_email(email)
    return normalize_invite_email(email)


def validate_project_invite_role(role):
    if role not in ProjectInvite.Role.values:
        raise ValidationError('Choose a valid invite role.', code='invalid_role')
    return role


def get_project_invite_by_token(token):
    if not token:
        return None

    return ProjectInvite.objects.select_related(
        'project',
        'invited_by',
        'accepted_by',
    ).filter(token=token).first()


def expire_pending_project_invites(project=None, email=None):
    queryset = ProjectInvite.objects.filter(
        status=ProjectInvite.Status.PENDING,
        expires_at__lte=timezone.now(),
    )
    if project is not None:
        queryset = queryset.filter(project=project)
    if email:
        queryset = queryset.filter(email__iexact=(email or '').strip())
    queryset.update(status=ProjectInvite.Status.EXPIRED)


def expire_invite_if_needed(invite):
    if invite is None:
        return None

    if invite.status == ProjectInvite.Status.PENDING and invite.is_expired():
        invite.status = ProjectInvite.Status.EXPIRED
        invite.save(update_fields=['status'])

    return invite


def get_project_invite_state(invite):
    if invite is None:
        return 'invalid'

    expire_invite_if_needed(invite)

    if invite.status == ProjectInvite.Status.PENDING:
        return 'pending'
    if invite.status == ProjectInvite.Status.ACCEPTED:
        return 'accepted'
    if invite.status == ProjectInvite.Status.REVOKED:
        return 'revoked'
    if invite.status == ProjectInvite.Status.EXPIRED:
        return 'expired'
    return 'invalid'


def get_active_project_invite(project, email):
    cleaned_email = (email or '').strip()
    if not cleaned_email:
        return None

    expire_pending_project_invites(project=project, email=cleaned_email)
    return ProjectInvite.objects.filter(
        project=project,
        email__iexact=cleaned_email,
        status=ProjectInvite.Status.PENDING,
        expires_at__gt=timezone.now(),
    ).first()


def project_has_member_with_email(project, email):
    cleaned_email = (email or '').strip()
    if not cleaned_email:
        return False

    user = get_user_model().objects.filter(email__iexact=cleaned_email).first()
    if user is None:
        return False

    return ProjectMember.objects.filter(project=project, user=user).exists()


def create_project_invite(project, invited_by, email, role):
    cleaned_email = validate_project_invite_email(email)
    validated_role = validate_project_invite_role(role)

    if project_has_member_with_email(project, cleaned_email):
        raise ValidationError('This user is already a project member.', code='already_member')

    existing_invite = get_active_project_invite(project, cleaned_email)
    if existing_invite is not None:
        raise ValidationError('An active invite for this email already exists.', code='invite_exists')

    return ProjectInvite.objects.create(
        project=project,
        email=cleaned_email,
        role=validated_role,
        invited_by=invited_by,
    )


def build_project_invite_url(request, invite):
    return request.build_absolute_uri(
        reverse('animation:invite_detail', kwargs={'token': invite.token}),
    )


def get_project_invite_path(token):
    return reverse('animation:invite_detail', kwargs={'token': token})


def build_project_invite_rows(request, project):
    rows = []
    invites = project.invites.select_related('invited_by', 'accepted_by').order_by('-created_at', '-id')
    for invite in invites:
        state = get_project_invite_state(invite)
        if state != 'pending':
            continue
        rows.append({
            'invite': invite,
            'state': state,
            'invite_url': build_project_invite_url(request, invite),
            'can_revoke': state == ProjectInvite.Status.PENDING,
        })
    return rows


def accept_project_invite(invite, user):
    state = get_project_invite_state(invite)
    if state == 'accepted':
        raise ValidationError('This invitation has already been accepted.', code='already_accepted')
    if state == 'revoked':
        raise ValidationError('This invitation has been revoked.', code='invite_revoked')
    if state == 'expired':
        raise ValidationError('This invitation has expired.', code='invite_expired')
    if state != 'pending':
        raise ValidationError('This invitation is no longer available.', code='invite_unavailable')
    if not invite.can_be_accepted_by(user):
        raise ValidationError('This invitation was sent to a different email address.', code='email_mismatch')

    with transaction.atomic():
        member, _ = ProjectMember.objects.update_or_create(
            project=invite.project,
            user=user,
            defaults={
                'role': invite.role,
                'invited_by': invite.invited_by,
                'is_active': True,
            },
        )
        invite.accepted_at = timezone.now()
        invite.accepted_by = user
        invite.status = ProjectInvite.Status.ACCEPTED
        invite.save(update_fields=['accepted_at', 'accepted_by', 'status'])

    return member


def revoke_project_invite(invite):
    if invite.status == ProjectInvite.Status.ACCEPTED:
        raise ValidationError('Accepted invites cannot be revoked.', code='already_accepted')

    if invite.status != ProjectInvite.Status.REVOKED:
        invite.status = ProjectInvite.Status.REVOKED
        invite.save(update_fields=['status'])

    return invite


def remember_pending_invite_token(request, token):
    request.session[PENDING_PROJECT_INVITE_SESSION_KEY] = token


def clear_pending_invite_token(request, token=None):
    stored = request.session.get(PENDING_PROJECT_INVITE_SESSION_KEY)
    if token is not None and stored != token:
        return
    request.session.pop(PENDING_PROJECT_INVITE_SESSION_KEY, None)
