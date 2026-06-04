from django.contrib.auth import REDIRECT_FIELD_NAME
from django.shortcuts import resolve_url
from django.utils.http import url_has_allowed_host_and_scheme

from animation.services.invite_service import (
    PENDING_PROJECT_INVITE_SESSION_KEY,
    get_project_invite_path,
)


def get_post_auth_redirect(request):
    redirect_to = request.POST.get(REDIRECT_FIELD_NAME) or request.GET.get(REDIRECT_FIELD_NAME)
    if redirect_to and url_has_allowed_host_and_scheme(
        redirect_to,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return redirect_to

    invite_token = request.session.get(PENDING_PROJECT_INVITE_SESSION_KEY)
    if invite_token:
        return get_project_invite_path(invite_token)

    return resolve_url("animation:project_list")
