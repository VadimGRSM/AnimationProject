from django.apps import AppConfig


class AnimationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "animation"

    def ready(self):
        from . import signals  # noqa: F401
