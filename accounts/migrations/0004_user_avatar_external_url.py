from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_remove_profile_interface_language"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_external_url",
            field=models.URLField(blank=True, verbose_name="External avatar URL"),
        ),
    ]
