from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('animation', '0008_framelock'),
    ]

    operations = [
        migrations.AddField(
            model_name='frame',
            name='content_revision',
            field=models.PositiveIntegerField(default=0, verbose_name='Frame content revision'),
        ),
    ]
