from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('animation', '0004_animationproject_main_audio_segments'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='animationproject',
            name='main_audio',
        ),
        migrations.RemoveField(
            model_name='animationproject',
            name='main_audio_duration',
        ),
        migrations.RemoveField(
            model_name='animationproject',
            name='main_audio_segments',
        ),
        migrations.RemoveField(
            model_name='animationproject',
            name='main_audio_start_frame',
        ),
    ]
