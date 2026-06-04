from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.urls import reverse

from allauth.socialaccount.models import SocialAccount, SocialLogin

from .adapters import apply_google_profile_to_user


User = get_user_model()


class AccountsFlowTests(TestCase):
    def test_profile_is_created_for_new_user(self):
        user = User.objects.create_user(email="user@example.com", password="StrongPassword123")

        self.assertTrue(hasattr(user, "profile"))
        self.assertEqual(user.display_name, "user")

    def test_avatar_url_falls_back_to_google_avatar(self):
        user = User(
            email="google@example.com",
            display_name="Google User",
            avatar_external_url="https://lh3.googleusercontent.com/avatar.png",
        )

        self.assertEqual(user.avatar_url, "https://lh3.googleusercontent.com/avatar.png")

    def test_google_profile_data_populates_user(self):
        user = User(email="google@example.com")
        sociallogin = SocialLogin(
            user=user,
            account=SocialAccount(
                provider="google",
                uid="google-123",
                extra_data={
                    "email": "google@example.com",
                    "name": "Google Artist",
                    "given_name": "Google",
                    "family_name": "Artist",
                    "picture": "https://lh3.googleusercontent.com/avatar.png",
                },
            ),
        )

        changed_fields = apply_google_profile_to_user(user, sociallogin, overwrite=True)

        self.assertCountEqual(
            changed_fields,
            ["display_name", "first_name", "last_name", "avatar_external_url"],
        )
        self.assertEqual(user.display_name, "Google Artist")
        self.assertEqual(user.first_name, "Google")
        self.assertEqual(user.last_name, "Artist")
        self.assertEqual(user.avatar_external_url, "https://lh3.googleusercontent.com/avatar.png")

    def test_google_profile_sync_does_not_overwrite_custom_display_name(self):
        user = User.objects.create_user(
            email="linked@example.com",
            password="StrongPassword123",
            display_name="Local Name",
        )
        sociallogin = SocialLogin(
            user=user,
            account=SocialAccount(
                provider="google",
                uid="google-456",
                extra_data={
                    "name": "Google Name",
                    "given_name": "Google",
                    "family_name": "Name",
                    "picture": "https://lh3.googleusercontent.com/linked.png",
                },
            ),
        )

        apply_google_profile_to_user(user, sociallogin, commit=True)
        user.refresh_from_db()

        self.assertEqual(user.display_name, "Local Name")
        self.assertEqual(user.first_name, "Google")
        self.assertEqual(user.last_name, "Name")
        self.assertEqual(user.avatar_external_url, "https://lh3.googleusercontent.com/linked.png")

    def test_google_social_auth_settings_are_enabled(self):
        self.assertEqual(settings.ACCOUNT_ADAPTER, "accounts.adapters.AnimStudioAccountAdapter")
        self.assertEqual(settings.SOCIALACCOUNT_ADAPTER, "accounts.adapters.AnimStudioSocialAccountAdapter")
        self.assertTrue(settings.SOCIALACCOUNT_AUTO_SIGNUP)
        self.assertTrue(settings.SOCIALACCOUNT_EMAIL_AUTHENTICATION)
        self.assertTrue(settings.SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT)
        self.assertTrue(settings.SOCIALACCOUNT_LOGIN_ON_GET)

    def test_signup_creates_user_profile_and_session(self):
        response = self.client.post(
            reverse("account_signup"),
            {
                "email": "artist@example.com",
                "display_name": "Artist",
                "password1": "VeryStrongPassword123",
                "password2": "VeryStrongPassword123",
            },
        )

        self.assertEqual(response.status_code, 302)
        user = User.objects.get(email="artist@example.com")
        self.assertEqual(user.display_name, "Artist")
        self.assertEqual(self.client.session.get("_auth_user_id"), str(user.pk))

    def test_signup_preserves_next_redirect(self):
        invite_url = reverse("animation:invite_detail", kwargs={"token": "test-token"})

        response = self.client.post(
            reverse("account_signup"),
            {
                "email": "next@example.com",
                "display_name": "Next User",
                "password1": "VeryStrongPassword123",
                "password2": "VeryStrongPassword123",
                "next": invite_url,
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, invite_url)

    def test_profile_page_is_available(self):
        user = User.objects.create_user(email="profile@example.com", password="StrongPassword123")
        self.client.force_login(user)

        response = self.client.get(reverse("account_profile"))

        self.assertEqual(response.status_code, 200)

    def test_profile_edit_updates_user_and_profile(self):
        user = User.objects.create_user(email="profile@example.com", password="StrongPassword123")
        self.client.force_login(user)

        response = self.client.post(
            reverse("account_profile_edit"),
            {
                "display_name": "Storyboard Master",
                "theme_preference": "dark",
            },
        )

        self.assertEqual(response.status_code, 302)
        user.refresh_from_db()
        self.assertEqual(user.display_name, "Storyboard Master")
        self.assertEqual(user.profile.theme_preference, "dark")

    def test_password_reset_sends_email(self):
        User.objects.create_user(
            email="reset@example.com",
            password="StrongPassword123",
            display_name="Reset User",
        )

        response = self.client.post(
            reverse("account_reset_password"),
            {
                "email": "reset@example.com",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(mail.outbox), 1)
