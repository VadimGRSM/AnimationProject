from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('animation', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Layer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=1, verbose_name='Layer order')),
                ('name', models.CharField(max_length=200, verbose_name='Layer name')),
                ('visible', models.BooleanField(default=True, verbose_name='Visible')),
                ('opacity', models.PositiveSmallIntegerField(default=100, verbose_name='Opacity (0-100)')),
                ('frame', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='layers', to='animation.frame')),
            ],
            options={
                'ordering': ['frame', 'order', 'id'],
            },
        ),
    ]
