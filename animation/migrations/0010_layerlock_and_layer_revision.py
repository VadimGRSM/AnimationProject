from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('animation', '0009_frame_content_revision'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='layer',
            name='content_revision',
            field=models.PositiveIntegerField(default=0, verbose_name='Layer content revision'),
        ),
        migrations.CreateModel(
            name='LayerLock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('acquired_at', models.DateTimeField(auto_now_add=True)),
                ('last_heartbeat_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('expires_at', models.DateTimeField()),
                ('frame', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='layer_locks', to='animation.frame')),
                ('layer', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='layer_lock', to='animation.layer')),
                ('presence_session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='layer_locks', to='animation.projectpresencesession')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='layer_locks', to='animation.animationproject')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='layer_locks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['project', 'frame', 'expires_at'], name='animation_l_project_0ca8e0_idx'),
                    models.Index(fields=['project', 'user'], name='animation_l_project_542477_idx'),
                    models.Index(fields=['presence_session', 'expires_at'], name='animation_l_presenc_0acc42_idx'),
                ],
            },
        ),
    ]
