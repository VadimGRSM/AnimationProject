from datetime import timedelta

from django.utils import timezone

from .models import Frame, ProjectPresenceSession

PRESENCE_STALE_AFTER_SECONDS = 90


def get_presence_cutoff(now=None):
    now = now or timezone.now()
    return now - timedelta(seconds=PRESENCE_STALE_AFTER_SECONDS)


def cleanup_stale_project_presence_sessions(project_id, now=None):
    now = now or timezone.now()
    cutoff = get_presence_cutoff(now)
    return ProjectPresenceSession.objects.filter(
        project_id=project_id,
        is_active=True,
        last_seen_at__lt=cutoff,
    ).update(
        is_active=False,
        last_seen_at=now,
    )


def _active_presence_queryset(project_id, now=None):
    now = now or timezone.now()
    cutoff = get_presence_cutoff(now)
    return ProjectPresenceSession.objects.filter(
        project_id=project_id,
        is_active=True,
        last_seen_at__gte=cutoff,
    ).select_related(
        'user',
        'current_frame',
    ).order_by(
        '-last_seen_at',
        '-joined_at',
        '-pk',
    )


def _serialize_presence_session(session):
    user = session.user
    display_name = getattr(user, 'display_name', '') or getattr(user, 'email', '') or f'User {user.pk}'
    return {
        'user_id': session.user_id,
        'display_name': display_name,
        'email': getattr(user, 'email', ''),
        'role': session.role,
        'current_frame_id': session.current_frame_id,
        'current_frame_index': session.current_frame.index if session.current_frame_id else None,
    }


def _build_presence_users(sessions):
    users = {}
    for session in sessions:
        if session.user_id in users:
            continue
        users[session.user_id] = _serialize_presence_session(session)
    return sorted(
        users.values(),
        key=lambda item: (
            item['display_name'].casefold(),
            item['email'].casefold(),
            item['user_id'],
        ),
    )


def get_project_presence_snapshot(project_id, now=None):
    cleanup_stale_project_presence_sessions(project_id, now=now)
    sessions = list(_active_presence_queryset(project_id, now=now))
    return _build_presence_users(sessions)


def get_project_presence_user(project_id, user_id, now=None):
    cleanup_stale_project_presence_sessions(project_id, now=now)
    sessions = list(
        _active_presence_queryset(project_id, now=now).filter(user_id=user_id)
    )
    users = _build_presence_users(sessions)
    return users[0] if users else None


def _get_initial_presence_frame_id(project_id):
    return Frame.objects.filter(project_id=project_id).order_by('index', 'id').values_list('id', flat=True).first()


def activate_project_presence_session(project_id, user_id, channel_name, role, current_frame_id=None):
    now = timezone.now()
    cleanup_stale_project_presence_sessions(project_id, now=now)

    was_user_online = _active_presence_queryset(project_id, now=now).filter(user_id=user_id).exists()
    frame_id = current_frame_id or _get_initial_presence_frame_id(project_id)

    session, _ = ProjectPresenceSession.objects.update_or_create(
        channel_name=channel_name,
        defaults={
            'project_id': project_id,
            'user_id': user_id,
            'current_frame_id': frame_id,
            'role': role,
            'last_seen_at': now,
            'is_active': True,
        },
    )

    return {
        'presence_session_id': session.pk,
        'snapshot': get_project_presence_snapshot(project_id, now=now),
        'joined_user': None if was_user_online else get_project_presence_user(project_id, user_id, now=now),
    }


def deactivate_project_presence_session(project_id, user_id, channel_name):
    now = timezone.now()
    cleanup_stale_project_presence_sessions(project_id, now=now)

    updated = ProjectPresenceSession.objects.filter(
        project_id=project_id,
        user_id=user_id,
        channel_name=channel_name,
        is_active=True,
    ).update(
        is_active=False,
        last_seen_at=now,
    )
    if not updated:
        return {
            'left_user_id': None,
            'user_still_online': False,
        }

    remaining_presence = get_project_presence_user(project_id, user_id, now=now)
    return {
        'left_user_id': user_id if remaining_presence is None else None,
        'user_still_online': remaining_presence is not None,
    }


def touch_project_presence_session(project_id, user_id, channel_name):
    now = timezone.now()
    cleanup_stale_project_presence_sessions(project_id, now=now)
    return ProjectPresenceSession.objects.filter(
        project_id=project_id,
        user_id=user_id,
        channel_name=channel_name,
        is_active=True,
    ).update(last_seen_at=now) > 0


def set_project_presence_frame(project_id, user_id, channel_name, frame_id):
    now = timezone.now()
    cleanup_stale_project_presence_sessions(project_id, now=now)

    session = ProjectPresenceSession.objects.filter(
        project_id=project_id,
        user_id=user_id,
        channel_name=channel_name,
        is_active=True,
    ).first()
    if session is None:
        return {
            'changed': False,
            'user': None,
        }

    next_frame_id = None
    if frame_id is not None:
        next_frame_id = Frame.objects.filter(
            project_id=project_id,
            pk=frame_id,
        ).values_list('id', flat=True).first()
        if next_frame_id is None:
            return {
                'changed': False,
                'user': None,
            }

    changed = session.current_frame_id != next_frame_id
    ProjectPresenceSession.objects.filter(pk=session.pk).update(
        current_frame_id=next_frame_id,
        last_seen_at=now,
    )

    return {
        'changed': changed,
        'user': get_project_presence_user(project_id, user_id, now=now),
    }
