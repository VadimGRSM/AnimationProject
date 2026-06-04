from urllib.parse import urlparse

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

from .auth_redirects import get_post_auth_redirect


def _clean_text(value):
    if isinstance(value, str):
        value = value.strip()
        if value:
            return value
    return ""


def _is_web_url(value):
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _profile_data_from_sociallogin(sociallogin, data=None):
    account = getattr(sociallogin, "account", None)
    if not account or account.provider != "google":
        return {}

    extra_data = getattr(account, "extra_data", None) or {}
    data = data or {}
    return {
        "email": _clean_text(data.get("email") or extra_data.get("email")),
        "name": _clean_text(data.get("name") or extra_data.get("name")),
        "first_name": _clean_text(data.get("first_name") or extra_data.get("given_name")),
        "last_name": _clean_text(data.get("last_name") or extra_data.get("family_name")),
        "picture": _clean_text(extra_data.get("picture")),
    }


def apply_google_profile_to_user(user, sociallogin, data=None, overwrite=False, commit=False):
    profile_data = _profile_data_from_sociallogin(sociallogin, data=data)
    if not profile_data:
        return []

    changed_fields = []

    display_name = profile_data["name"] or profile_data["email"].split("@", 1)[0]
    current_default_name = user.email.split("@", 1)[0] if user.email else ""
    if display_name and (overwrite or not user.display_name or user.display_name == current_default_name):
        if user.display_name != display_name:
            user.display_name = display_name
            changed_fields.append("display_name")

    for field_name, value in (
        ("first_name", profile_data["first_name"]),
        ("last_name", profile_data["last_name"]),
    ):
        if value and (overwrite or not getattr(user, field_name)):
            if getattr(user, field_name) != value:
                setattr(user, field_name, value)
                changed_fields.append(field_name)

    picture = profile_data["picture"]
    if picture and _is_web_url(picture) and getattr(user, "avatar_external_url", "") != picture:
        user.avatar_external_url = picture
        changed_fields.append("avatar_external_url")

    if commit and changed_fields and user.pk:
        user.save(update_fields=changed_fields)

    return changed_fields


class AnimStudioAccountAdapter(DefaultAccountAdapter):
    def get_login_redirect_url(self, request):
        return get_post_auth_redirect(request)

    def get_signup_redirect_url(self, request):
        return get_post_auth_redirect(request)


class AnimStudioSocialAccountAdapter(DefaultSocialAccountAdapter):
    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        apply_google_profile_to_user(user, sociallogin, data=data, overwrite=True, commit=False)
        return user

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form=form)
        apply_google_profile_to_user(user, sociallogin, overwrite=True, commit=True)
        return user
