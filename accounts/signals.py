from django.db.models.signals import post_save
from django.dispatch import receiver

from allauth.socialaccount.signals import social_account_added, social_account_updated

from .adapters import apply_google_profile_to_user
from .models import Profile, User


@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
        return

    Profile.objects.get_or_create(user=instance)


@receiver(social_account_added)
@receiver(social_account_updated)
def sync_google_profile(sender, sociallogin, **kwargs):
    user = getattr(sociallogin, "user", None)
    if not user:
        return

    apply_google_profile_to_user(user, sociallogin, overwrite=False, commit=True)
