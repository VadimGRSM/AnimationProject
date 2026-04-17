from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME, login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render, resolve_url
from django.utils.http import url_has_allowed_host_and_scheme

from animation.services.invite_service import (
    PENDING_PROJECT_INVITE_SESSION_KEY,
    get_project_invite_path,
)

from .forms import ProfileEditForm, SignUpForm


def _get_post_auth_redirect(request):
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


def signup_view(request):
    if request.user.is_authenticated:
        return redirect(_get_post_auth_redirect(request))

    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user, backend="django.contrib.auth.backends.ModelBackend")
            messages.success(request, "Account created. Welcome to AnimStudio.")
            return redirect(_get_post_auth_redirect(request))
    else:
        form = SignUpForm()

    redirect_field_value = request.POST.get(REDIRECT_FIELD_NAME) or request.GET.get(REDIRECT_FIELD_NAME) or ""
    return render(
        request,
        "accounts/signup.html",
        {
            "form": form,
            "redirect_field_name": REDIRECT_FIELD_NAME,
            "redirect_field_value": redirect_field_value,
        },
    )


@login_required
def profile_view(request):
    return render(
        request,
        "accounts/profile.html",
        {
            "profile": request.user.profile,
        },
    )


@login_required
def profile_edit_view(request):
    profile = request.user.profile

    if request.method == "POST":
        form = ProfileEditForm(
            request.POST,
            request.FILES,
            instance=profile,
            user=request.user,
        )
        if form.is_valid():
            form.save()
            messages.success(request, "Profile saved.")
            return redirect("account_profile")
    else:
        form = ProfileEditForm(instance=profile, user=request.user)

    return render(
        request,
        "accounts/profile_edit.html",
        {
            "form": form,
            "profile": profile,
        },
    )
