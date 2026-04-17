from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AnimationProject


@receiver(post_save, sender=AnimationProject)
def ensure_project_owner_membership(sender, instance, raw, **kwargs):
    if raw:
        return

    instance.ensure_owner_membership()
