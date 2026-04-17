from django.core.exceptions import ValidationError

from ..models import ProjectMember


def build_project_member_rows(project):
    members = list(
        project.memberships.select_related('user', 'invited_by').order_by('joined_at', 'id')
    )
    return sorted(
        members,
        key=lambda member: (
            0 if member.role == ProjectMember.Role.OWNER else 1,
            (member.user.display_name or member.user.email).casefold(),
            member.user.email.casefold(),
        ),
    )


def update_project_member_role(project, member, role):
    if member.project_id != project.pk:
        raise ValidationError('Invalid project member.', code='invalid_member')

    if member.role == ProjectMember.Role.OWNER or member.user_id == project.owner_id:
        raise ValidationError('Owner role cannot be changed here.', code='cannot_change_owner')

    if role not in {ProjectMember.Role.EDITOR, ProjectMember.Role.VIEWER}:
        raise ValidationError('Choose a valid member role.', code='invalid_role')

    if member.role != role or not member.is_active:
        member.role = role
        member.is_active = True
        member.save(update_fields=['role', 'is_active'])

    return member


def remove_project_member(project, member):
    if member.project_id != project.pk:
        raise ValidationError('Invalid project member.', code='invalid_member')

    if member.role == ProjectMember.Role.OWNER or member.user_id == project.owner_id:
        raise ValidationError('Owner cannot be removed from the project.', code='cannot_remove_owner')

    removed_email = member.user.email
    member.delete()
    return removed_email
