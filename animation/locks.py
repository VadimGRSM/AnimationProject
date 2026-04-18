from datetime import timedelta
import logging

from django.db import transaction
from django.utils import timezone

from .models import Frame, FrameLock, ProjectMember, ProjectPresenceSession
from .presence import get_presence_cutoff

FRAME_LOCK_TTL_SECONDS = 35
logger = logging.getLogger(__name__)


def get_frame_lock_expires_at(now=None):
    now = now or timezone.now()
    return now + timedelta(seconds=FRAME_LOCK_TTL_SECONDS)


def _serialize_user(user):
    display_name = getattr(user, 'display_name', '') or getattr(user, 'email', '') or f'User {user.pk}'
    return {
        'user_id': user.pk,
        'display_name': display_name,
        'email': getattr(user, 'email', ''),
    }


def _serialize_frame_lock(lock):
    return {
        'frame_id': lock.frame_id,
        'frame_index': lock.frame.index,
        'user_id': lock.user_id,
        'display_name': getattr(lock.user, 'display_name', '') or getattr(lock.user, 'email', '') or f'User {lock.user_id}',
        'email': getattr(lock.user, 'email', ''),
        'role': getattr(lock.presence_session, 'role', '') or '',
        'presence_session_id': lock.presence_session_id,
        'expires_at': lock.expires_at.isoformat() if lock.expires_at else '',
    }


def _active_lock_queryset(project_id, now=None):
    now = now or timezone.now()
    presence_cutoff = get_presence_cutoff(now)
    return FrameLock.objects.filter(
        project_id=project_id,
        expires_at__gt=now,
        presence_session__isnull=False,
        presence_session__is_active=True,
        presence_session__last_seen_at__gte=presence_cutoff,
    ).select_related(
        'frame',
        'user',
        'presence_session',
    ).order_by('frame__index', 'frame_id')


def cleanup_stale_frame_locks(project_id, now=None):
    now = now or timezone.now()
    presence_cutoff = get_presence_cutoff(now)
    stale_locks = list(
        FrameLock.objects.filter(project_id=project_id)
        .select_related('frame', 'user', 'presence_session')
        .filter(
            expires_at__lte=now,
        )
    )
    stale_locks += list(
        FrameLock.objects.filter(project_id=project_id)
        .select_related('frame', 'user', 'presence_session')
        .filter(
            expires_at__gt=now,
            presence_session__isnull=True,
        )
    )
    stale_locks += list(
        FrameLock.objects.filter(project_id=project_id)
        .select_related('frame', 'user', 'presence_session')
        .filter(
            expires_at__gt=now,
            presence_session__isnull=False,
            presence_session__is_active=False,
        )
    )
    stale_locks += list(
        FrameLock.objects.filter(project_id=project_id)
        .select_related('frame', 'user', 'presence_session')
        .filter(
            expires_at__gt=now,
            presence_session__isnull=False,
            presence_session__is_active=True,
            presence_session__last_seen_at__lt=presence_cutoff,
        )
    )

    unique_stale_locks = {lock.pk: lock for lock in stale_locks if lock.pk is not None}
    if unique_stale_locks:
        FrameLock.objects.filter(pk__in=list(unique_stale_locks.keys())).delete()
        logger.info(
            "Stale frame locks cleaned up",
            extra={"project_id": project_id, "stale_lock_count": len(unique_stale_locks)},
        )
    return [_serialize_frame_lock(lock) for lock in unique_stale_locks.values()]


def get_project_frame_lock_snapshot(project_id, now=None):
    now = now or timezone.now()
    stale_releases = cleanup_stale_frame_locks(project_id, now=now)
    locks = [_serialize_frame_lock(lock) for lock in _active_lock_queryset(project_id, now=now)]
    return {
        'locks': locks,
        'stale_releases': stale_releases,
    }


def _get_active_presence_session(project_id, user_id, presence_session_id, now):
    presence_cutoff = get_presence_cutoff(now)
    return ProjectPresenceSession.objects.filter(
        pk=presence_session_id,
        project_id=project_id,
        user_id=user_id,
        is_active=True,
        last_seen_at__gte=presence_cutoff,
    ).first()


def _user_can_lock_frame(role):
    return role in {ProjectMember.Role.OWNER, ProjectMember.Role.EDITOR}


@transaction.atomic
def acquire_frame_lock(project_id, frame_id, user_id, role, presence_session_id):
    now = timezone.now()
    stale_releases = cleanup_stale_frame_locks(project_id, now=now)

    presence_session = _get_active_presence_session(project_id, user_id, presence_session_id, now)
    if presence_session is None:
        return {
            'status': 'denied',
            'reason': 'invalid_session',
            'lock': None,
            'released': stale_releases,
        }

    frame = Frame.objects.select_for_update().filter(
        project_id=project_id,
        pk=frame_id,
    ).first()
    if frame is None:
        return {
            'status': 'denied',
            'reason': 'invalid_frame',
            'lock': None,
            'released': stale_releases,
        }

    if not _user_can_lock_frame(role):
        return {
            'status': 'denied',
            'reason': 'read_only_role',
            'lock': None,
            'released': stale_releases,
        }

    existing_lock = FrameLock.objects.select_for_update().select_related(
        'frame',
        'user',
        'presence_session',
    ).filter(frame_id=frame.pk).first()
    if existing_lock and existing_lock.presence_session_id != presence_session.pk:
        return {
            'status': 'denied',
            'reason': 'locked_by_other',
            'lock': _serialize_frame_lock(existing_lock),
            'released': stale_releases,
        }

    expires_at = get_frame_lock_expires_at(now)
    if existing_lock is None:
        lock = FrameLock.objects.create(
            project_id=project_id,
            frame=frame,
            user_id=user_id,
            presence_session=presence_session,
            last_heartbeat_at=now,
            expires_at=expires_at,
        )
    else:
        existing_lock.user_id = user_id
        existing_lock.presence_session = presence_session
        existing_lock.last_heartbeat_at = now
        existing_lock.expires_at = expires_at
        existing_lock.save(update_fields=['user', 'presence_session', 'last_heartbeat_at', 'expires_at'])
        lock = existing_lock

    other_locks = list(
        FrameLock.objects.select_related('frame', 'user', 'presence_session').filter(
            project_id=project_id,
            presence_session_id=presence_session.pk,
        ).exclude(frame_id=frame.pk)
    )
    released = stale_releases + [_serialize_frame_lock(other_lock) for other_lock in other_locks]
    if other_locks:
        FrameLock.objects.filter(pk__in=[other_lock.pk for other_lock in other_locks]).delete()

    return {
        'status': 'acquired',
        'reason': 'ok',
        'lock': _serialize_frame_lock(lock),
        'released': released,
    }


@transaction.atomic
def release_frame_locks(project_id, user_id, presence_session_id, frame_id=None):
    now = timezone.now()
    released = cleanup_stale_frame_locks(project_id, now=now)

    locks_qs = FrameLock.objects.select_related('frame', 'user', 'presence_session').filter(
        project_id=project_id,
        user_id=user_id,
        presence_session_id=presence_session_id,
    )
    if frame_id is not None:
        locks_qs = locks_qs.filter(frame_id=frame_id)

    locks = list(locks_qs)
    released.extend(_serialize_frame_lock(lock) for lock in locks)
    if locks:
        FrameLock.objects.filter(pk__in=[lock.pk for lock in locks]).delete()
    return released


@transaction.atomic
def heartbeat_frame_lock(project_id, frame_id, user_id, presence_session_id):
    now = timezone.now()
    released = cleanup_stale_frame_locks(project_id, now=now)

    updated = FrameLock.objects.filter(
        project_id=project_id,
        frame_id=frame_id,
        user_id=user_id,
        presence_session_id=presence_session_id,
    ).update(
        last_heartbeat_at=now,
        expires_at=get_frame_lock_expires_at(now),
    )
    return {
        'updated': updated > 0,
        'released': released,
    }
