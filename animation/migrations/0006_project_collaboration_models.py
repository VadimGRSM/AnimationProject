import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import animation.models


def create_owner_memberships(apps, schema_editor):
    AnimationProject = apps.get_model('animation', 'AnimationProject')
    ProjectMember = apps.get_model('animation', 'ProjectMember')

    for project in AnimationProject.objects.all().iterator():
        ProjectMember.objects.get_or_create(
            project_id=project.pk,
            user_id=project.owner_id,
            defaults={
                'role': 'owner',
                'is_active': True,
                'invited_by_id': None,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('animation', '0005_remove_animationproject_main_audio_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('owner', 'Owner'), ('editor', 'Editor'), ('viewer', 'Viewer')], default='viewer', max_length=16)),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('invited_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sent_project_memberships', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to='animation.animationproject')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'constraints': [
                    models.UniqueConstraint(fields=('project', 'user'), name='unique_project_member'),
                ],
            },
        ),
        migrations.CreateModel(
            name='ProjectInvite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254)),
                ('role', models.CharField(choices=[('editor', 'Editor'), ('viewer', 'Viewer')], default='viewer', max_length=16)),
                ('token', models.CharField(default=animation.models.generate_project_invite_token, editable=False, max_length=255, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(default=animation.models.default_project_invite_expiry)),
                ('accepted_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('revoked', 'Revoked'), ('expired', 'Expired')], default='pending', max_length=16)),
                ('accepted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accepted_project_invites', to=settings.AUTH_USER_MODEL)),
                ('invited_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sent_project_invites', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invites', to='animation.animationproject')),
            ],
        ),
        migrations.RunPython(create_owner_memberships, migrations.RunPython.noop),
    ]
