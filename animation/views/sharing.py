from urllib.parse import urlencode

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST, require_http_methods

from ..access import get_manageable_project_or_404, get_project_membership
from ..models import ProjectInvite, ProjectMember
from ..services.invite_service import (
    accept_project_invite,
    build_project_invite_rows,
    build_project_invite_url,
    clear_pending_invite_token,
    create_project_invite,
    get_project_invite_by_token,
    get_project_invite_path,
    get_project_invite_state,
    normalize_invite_email,
    remember_pending_invite_token,
    revoke_project_invite,
)
from ..services.member_service import (
    build_project_member_rows,
    remove_project_member,
    update_project_member_role,
)


def _get_request_payload(request):
    if request.content_type and 'application/json' in request.content_type:
        import json

        try:
            payload = json.loads(request.body.decode('utf-8')) if request.body else {}
        except json.JSONDecodeError:
            return None
        return payload if isinstance(payload, dict) else None
    return request.POST


def _get_login_redirect_for_invite(request, token):
    invite_path = get_project_invite_path(token)
    query_string = urlencode({'next': invite_path})
    return f"{reverse('account_login')}?{query_string}"


def _is_ajax_request(request):
    return request.headers.get('x-requested-with') == 'XMLHttpRequest'


def _validation_code(error):
    if hasattr(error, 'code') and error.code:
        return error.code
    if hasattr(error, 'error_list') and error.error_list:
        first_error = error.error_list[0]
        if getattr(first_error, 'code', None):
            return first_error.code
    return 'invalid'


@login_required
def project_share(request, pk):
    project = get_manageable_project_or_404(request.user, pk)
    member_rows = build_project_member_rows(project)
    invite_rows = build_project_invite_rows(request, project)
    return render(request, 'animation/project_share.html', {
        'project': project,
        'member_rows': member_rows,
        'invite_rows': invite_rows,
        'invite_roles': ProjectInvite.Role.choices,
        'member_roles': [
            choice for choice in ProjectMember.Role.choices
            if choice[0] != ProjectMember.Role.OWNER
        ],
    })


@login_required
@require_POST
def project_invite_create(request, pk):
    project = get_manageable_project_or_404(request.user, pk)
    is_ajax = _is_ajax_request(request)
    payload = _get_request_payload(request)
    if payload is None:
        if is_ajax:
            return JsonResponse({'ok': False, 'error': 'invalid_json'}, status=400)
        messages.error(request, 'Invalid invite data.')
        return redirect('animation:project_share', pk=project.pk)

    try:
        invite = create_project_invite(
            project=project,
            invited_by=request.user,
            email=payload.get('email'),
            role=(payload.get('role') or '').strip(),
        )
    except ValidationError as error:
        error_code = _validation_code(error)
        if is_ajax:
            return JsonResponse({'ok': False, 'error': error_code}, status=400)

        error_messages = {
            'invalid_email': 'Enter a valid email address.',
            'invalid_role': 'Choose a valid invite role.',
            'already_member': 'This user is already a project member.',
            'invite_exists': 'An active invite for this email already exists.',
        }
        messages.error(request, error_messages.get(error_code, 'Could not create the invite.'))
        return redirect('animation:project_share', pk=project.pk)

    invite_url = build_project_invite_url(request, invite)

    if not is_ajax:
        messages.success(request, f'Invite created for {invite.email}.')
        return redirect('animation:project_share', pk=project.pk)

    return JsonResponse({
        'ok': True,
        'invite': {
            'id': invite.pk,
            'email': invite.email,
            'role': invite.role,
            'status': invite.status,
            'token': invite.token,
            'expires_at': invite.expires_at.isoformat(),
            'invite_url': invite_url,
        },
    })


@require_http_methods(["GET"])
def invite_detail(request, token):
    invite = get_project_invite_by_token(token)
    state = get_project_invite_state(invite)

    if invite is not None and state == 'pending' and not request.user.is_authenticated:
        remember_pending_invite_token(request, token)
        messages.info(request, 'Log in or sign up to review this invitation.')
        return redirect(_get_login_redirect_for_invite(request, token))

    if request.user.is_authenticated:
        clear_pending_invite_token(request, token)

    project = invite.project if invite is not None else None
    membership = get_project_membership(request.user, project) if project is not None else None
    project_url = ''
    if project is not None and membership and membership.can_view():
        project_url = reverse('animation:project_editor', kwargs={'pk': project.pk})

    invite_path = get_project_invite_path(token)
    auth_query = urlencode({'next': invite_path})
    login_url = f"{reverse('account_login')}?{auth_query}"
    signup_url = f"{reverse('account_signup')}?{auth_query}"
    user_email = request.user.email if request.user.is_authenticated else ''
    email_matches = bool(
        request.user.is_authenticated
        and invite is not None
        and normalize_invite_email(user_email) == normalize_invite_email(invite.email)
    )
    can_accept = bool(request.user.is_authenticated and invite and invite.can_be_accepted_by(request.user))

    status_code = 404 if state == 'invalid' else 200
    return render(request, 'animation/invite_detail.html', {
        'invite': invite,
        'invite_state': state,
        'project': project,
        'project_url': project_url,
        'login_url': login_url,
        'signup_url': signup_url,
        'can_accept': can_accept,
        'email_matches': email_matches,
        'accept_url': reverse('animation:invite_accept', kwargs={'token': token}),
    }, status=status_code)


@require_POST
def invite_accept(request, token):
    invite = get_project_invite_by_token(token)
    if invite is None:
        messages.error(request, 'Invitation not found.')
        return redirect('animation:invite_detail', token=token)

    if not request.user.is_authenticated:
        remember_pending_invite_token(request, token)
        messages.info(request, 'Log in to accept this invitation.')
        return redirect(_get_login_redirect_for_invite(request, token))

    try:
        accept_project_invite(invite, request.user)
    except ValidationError as error:
        error_code = _validation_code(error)
        error_messages = {
            'already_accepted': 'This invitation has already been accepted.',
            'invite_revoked': 'This invitation has been revoked.',
            'invite_expired': 'This invitation has expired.',
            'invite_unavailable': 'This invitation is no longer available.',
            'email_mismatch': 'This invitation was sent to a different email address.',
        }
        messages.error(request, error_messages.get(error_code, 'Could not accept this invitation.'))
        return redirect('animation:invite_detail', token=token)

    clear_pending_invite_token(request, token)
    messages.success(request, f'Invitation accepted. You now have {invite.role} access to "{invite.project.title}".')
    return redirect('animation:project_editor', pk=invite.project.pk)


@login_required
@require_POST
def project_invite_revoke(request, pk, invite_id):
    project = get_manageable_project_or_404(request.user, pk)
    is_ajax = _is_ajax_request(request)
    invite = get_object_or_404(ProjectInvite, pk=invite_id, project=project)

    try:
        revoke_project_invite(invite)
    except ValidationError as error:
        error_code = _validation_code(error)
        if is_ajax:
            return JsonResponse({'ok': False, 'error': error_code}, status=400)
        messages.error(request, 'Accepted invites cannot be revoked.')
        return redirect('animation:project_share', pk=project.pk)

    if not is_ajax:
        messages.success(request, f'Invite for {invite.email} revoked.')
        return redirect('animation:project_share', pk=project.pk)

    return JsonResponse({
        'ok': True,
        'invite': {
            'id': invite.pk,
            'email': invite.email,
            'status': invite.status,
        },
    })


@login_required
@require_POST
def project_member_role_update(request, pk, member_id):
    project = get_manageable_project_or_404(request.user, pk)
    is_ajax = _is_ajax_request(request)
    member = get_object_or_404(
        ProjectMember.objects.select_related('user'),
        pk=member_id,
        project=project,
    )

    try:
        member = update_project_member_role(project, member, (request.POST.get('role') or '').strip())
    except ValidationError as error:
        error_code = _validation_code(error)
        if is_ajax:
            return JsonResponse({'ok': False, 'error': error_code}, status=400)

        error_messages = {
            'cannot_change_owner': 'Owner role cannot be changed here.',
            'invalid_role': 'Choose a valid member role.',
        }
        messages.error(request, error_messages.get(error_code, 'Could not update the member role.'))
        return redirect('animation:project_share', pk=project.pk)

    if not is_ajax:
        messages.success(request, f'Role updated for {member.user.email}.')
        return redirect('animation:project_share', pk=project.pk)

    return JsonResponse({
        'ok': True,
        'member': {
            'id': member.pk,
            'role': member.role,
            'email': member.user.email,
        },
    })


@login_required
@require_POST
def project_member_remove(request, pk, member_id):
    project = get_manageable_project_or_404(request.user, pk)
    is_ajax = _is_ajax_request(request)
    member = get_object_or_404(
        ProjectMember.objects.select_related('user'),
        pk=member_id,
        project=project,
    )

    try:
        removed_email = remove_project_member(project, member)
    except ValidationError as error:
        error_code = _validation_code(error)
        if is_ajax:
            return JsonResponse({'ok': False, 'error': error_code}, status=400)

        error_messages = {
            'cannot_remove_owner': 'Owner cannot be removed from the project.',
        }
        messages.error(request, error_messages.get(error_code, 'Could not remove the member.'))
        return redirect('animation:project_share', pk=project.pk)

    if not is_ajax:
        messages.success(request, f'{removed_email} removed from the project.')
        return redirect('animation:project_share', pk=project.pk)

    return JsonResponse({
        'ok': True,
        'member': {
            'id': member_id,
            'email': removed_email,
        },
    })
