from django.db.utils import OperationalError, ProgrammingError


def social_auth_context(request):
    try:
        from django.contrib.sites.shortcuts import get_current_site
        from allauth.socialaccount.models import SocialApp

        current_site = get_current_site(request)
        google_login_enabled = SocialApp.objects.filter(
            provider="google",
            sites=current_site,
        ).exists()
    except (OperationalError, ProgrammingError):
        google_login_enabled = False

    return {
        "google_login_enabled": google_login_enabled,
    }
