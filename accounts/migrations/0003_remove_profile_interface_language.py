from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_remove_profile_avatar_remove_profile_display_name_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="profile",
            name="interface_language",
        ),
    ]
