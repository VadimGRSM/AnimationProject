import io
import json
import tempfile
import zipfile

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from .models import AnimationProject, Frame

User = get_user_model()


def _make_png_bytes(size=(64, 64), color=(255, 0, 0, 255)):
    from PIL import Image

    image = Image.new('RGBA', size, color)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return buffer.getvalue()


class ExportSmokeTests(TestCase):
    def test_export_png_zip_and_gif(self):
        with tempfile.TemporaryDirectory() as tmp_media_root:
            with override_settings(MEDIA_ROOT=tmp_media_root):
                user = User.objects.create_user(email="export_test@example.com", password="test")
                project = AnimationProject.objects.create(
                    owner=user,
                    title='Export Test',
                    width=64,
                    height=64,
                    fps=12,
                )

                colors = [
                    (255, 0, 0, 255),
                    (0, 255, 0, 255),
                    (0, 0, 255, 255),
                ]
                for index, color in enumerate(colors, start=1):
                    frame = Frame.objects.create(project=project, index=index)
                    png_bytes = _make_png_bytes(size=(64, 64), color=color)
                    frame.preview_image.save(
                        f'project_{project.pk}_frame_{index}.png',
                        ContentFile(png_bytes),
                        save=True,
                    )

                client = Client()
                client.force_login(user)
                export_url = reverse('animation:project_export', kwargs={'pk': project.pk})

                # PNG ZIP
                response = client.post(
                    export_url,
                    data=json.dumps({
                        'format': 'png_zip',
                        'resolution': 'original',
                        'fps': 12,
                    }),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertIn('download_url', payload)

                download = client.get(payload['download_url'])
                self.assertEqual(download.status_code, 200)
                zip_bytes = b''.join(download.streaming_content)
                zf = zipfile.ZipFile(io.BytesIO(zip_bytes), mode='r')
                names = sorted(zf.namelist())
                self.assertEqual(names, ['frame_0001.png', 'frame_0002.png', 'frame_0003.png'])
                for name in names:
                    data = zf.read(name)
                    self.assertTrue(data.startswith(b'\x89PNG\r\n\x1a\n'))

                # GIF
                response = client.post(
                    export_url,
                    data=json.dumps({
                        'format': 'gif',
                        'resolution': '720p',
                        'fps': 12,
                        'loop_infinite': True,
                        'loop_count': 0,
                    }),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertIn('download_url', payload)

                download = client.get(payload['download_url'])
                self.assertEqual(download.status_code, 200)
                gif_bytes = b''.join(download.streaming_content)
                self.assertTrue(gif_bytes.startswith(b'GIF8'))
