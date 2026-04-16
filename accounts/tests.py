from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.urls import reverse


User = get_user_model()


class AccountsFlowTests(TestCase):
    def test_profile_is_created_for_new_user(self):
        user = User.objects.create_user(email="user@example.com", password="StrongPassword123")

        self.assertTrue(hasattr(user, "profile"))
        self.assertEqual(user.display_name, "user")

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
