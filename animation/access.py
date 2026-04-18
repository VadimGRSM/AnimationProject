from django.http import Http404
from django.shortcuts import get_object_or_404

from .models import AnimationProject, ProjectMember


def get_accessible_projects_queryset(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return AnimationProject.objects.none()

    return AnimationProject.objects.filter(
        memberships__user=user,
        memberships__is_active=True,
    ).distinct()


def get_project_membership(user, project):
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    if project is None:
        return None

    return ProjectMember.objects.filter(
        project=project,
        user=user,
    ).select_related('project', 'user').first()


def get_project_membership_for_user(project_id, user_id):
    if not project_id or not user_id:
        return None

    membership = ProjectMember.objects.filter(
        project_id=project_id,
        user_id=user_id,
        is_active=True,
    ).select_related('project', 'user').first()
    if membership is None or not membership.can_view():
        return None
    return membership


def user_can_access_project(project_id, user_id):
    return get_project_membership_for_user(project_id, user_id) is not None


def get_project_connection_context(project_id, user_id):
    membership = get_project_membership_for_user(project_id, user_id)
    if membership is not None:
        return {
            'project_id': membership.project_id,
            'user_id': membership.user_id,
            'role': membership.role,
            'project_exists': True,
        }

    return {
        'project_id': project_id,
        'user_id': user_id,
        'role': None,
        'project_exists': AnimationProject.objects.filter(pk=project_id).exists(),
    }


def get_project_role(user, project):
    membership = get_project_membership(user, project)
    if membership is None or not membership.is_active:
        return None
    return membership.role


def can_view_project(user, project):
    membership = get_project_membership(user, project)
    if membership is None:
        return False
    return membership.can_view()


def can_edit_project(user, project):
    membership = get_project_membership(user, project)
    if membership is None:
        return False
    return membership.can_edit()


def can_manage_project(user, project):
    membership = get_project_membership(user, project)
    if membership is None:
        return False
    return membership.can_manage_members()


def _get_project_with_membership_or_404(user, pk):
    project = get_object_or_404(
        AnimationProject.objects.select_related('owner'),
        pk=pk,
    )
    membership = get_project_membership(user, project)
    if membership is None or not membership.is_active:
        raise Http404('Project not found.')
    return project, membership


def get_accessible_project_or_404(user, pk):
    project, membership = _get_project_with_membership_or_404(user, pk)
    if not membership.can_view():
        raise Http404('Project not found.')
    return project


def get_editable_project_or_404(user, pk):
    project, membership = _get_project_with_membership_or_404(user, pk)
    if not membership.can_edit():
        raise Http404('Project not found.')
    return project


def get_manageable_project_or_404(user, pk):
    project, membership = _get_project_with_membership_or_404(user, pk)
    if not membership.can_manage_members():
        raise Http404('Project not found.')
    return project
