from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from .forms import ProfileEditForm, SignUpForm


def signup_view(request):
    if request.user.is_authenticated:
        return redirect("animation:project_list")

    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user, backend="django.contrib.auth.backends.ModelBackend")
            messages.success(request, "Account created. Welcome to AnimStudio.")
            return redirect("animation:project_list")
    else:
        form = SignUpForm()

    return render(
        request,
        "accounts/signup.html",
        {
            "form": form,
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
