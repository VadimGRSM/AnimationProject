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
