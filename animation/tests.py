import io
import json
import tempfile
import wave
import zipfile

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from .models import AnimationProject, Frame


def _make_png_bytes(size=(64, 64), color=(255, 0, 0, 255)):
    from PIL import Image

    image = Image.new('RGBA', size, color)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return buffer.getvalue()


def _make_wav_bytes(duration_seconds=1.0, sample_rate=8000):
    total_frames = max(1, int(sample_rate * duration_seconds))
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b'\x00\x00' * total_frames)
    return buffer.getvalue()


class ExportSmokeTests(TestCase):
    def test_export_png_zip_and_gif(self):
        with tempfile.TemporaryDirectory() as tmp_media_root:
            with override_settings(MEDIA_ROOT=tmp_media_root):
                user = User.objects.create_user(username='export_test', password='test')
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

    def test_export_mp4_with_main_audio(self):
        with tempfile.TemporaryDirectory() as tmp_media_root:
            with override_settings(MEDIA_ROOT=tmp_media_root):
                user = User.objects.create_user(username='mp4_export_test', password='test')
                project = AnimationProject.objects.create(
                    owner=user,
                    title='MP4 Export Test',
                    width=64,
                    height=64,
                    fps=4,
                    main_audio_duration=1.0,
                    main_audio_start_frame=2,
                )

                for index, color in enumerate(((255, 0, 0, 255), (0, 255, 0, 255)), start=1):
                    frame = Frame.objects.create(project=project, index=index)
                    frame.preview_image.save(
                        f'project_{project.pk}_frame_{index}.png',
                        ContentFile(_make_png_bytes(size=(64, 64), color=color)),
                        save=True,
                    )

                project.main_audio.save(
                    'main_audio.wav',
                    ContentFile(_make_wav_bytes(duration_seconds=1.0)),
                    save=True,
                )
                project.main_audio_segments = [
                    {
                        'id': 'seg-a',
                        'start_frame': 1,
                        'frame_length': 2,
                        'source_start_seconds': 0.0,
                        'source_duration_seconds': 0.5,
                    },
                    {
                        'id': 'seg-b',
                        'start_frame': 2,
                        'frame_length': 2,
                        'source_start_seconds': 0.5,
                        'source_duration_seconds': 0.5,
                    },
                ]
                project.save(update_fields=['main_audio_segments', 'updated_at'])

                client = Client()
                client.force_login(user)
                export_url = reverse('animation:project_export', kwargs={'pk': project.pk})
                response = client.post(
                    export_url,
                    data=json.dumps({
                        'format': 'mp4',
                        'resolution': 'original',
                    }),
                    content_type='application/json',
                )

                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertEqual(payload.get('format'), 'mp4')
                self.assertTrue(payload.get('filename', '').endswith('.mp4'))

                download = client.get(payload['download_url'])
                self.assertEqual(download.status_code, 200)
                video_bytes = b''.join(download.streaming_content)
                self.assertIn(b'ftyp', video_bytes[:64])


class ProjectAudioApiTests(TestCase):
    def test_upload_get_and_delete_main_audio(self):
        with tempfile.TemporaryDirectory() as tmp_media_root:
            with override_settings(MEDIA_ROOT=tmp_media_root):
                user = User.objects.create_user(username='audio_api_test', password='test')
                project = AnimationProject.objects.create(
                    owner=user,
                    title='Audio API Test',
                    width=64,
                    height=64,
                    fps=12,
                )

                client = Client()
                client.force_login(user)
                upload_url = reverse('animation:project_audio_upload', kwargs={'pk': project.pk})
                detail_url = reverse('animation:project_audio_detail', kwargs={'pk': project.pk})

                response = client.post(
                    upload_url,
                    data={
                        'audio': SimpleUploadedFile(
                            'voice.wav',
                            _make_wav_bytes(duration_seconds=1.25),
                            content_type='audio/wav',
                        ),
                        'start_frame': 5,
                    },
                )

                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertTrue(payload['audio']['has_audio'])
                self.assertEqual(payload['audio']['start_frame'], 5)
                self.assertAlmostEqual(payload['audio']['duration_seconds'], 1.25, delta=0.05)
                self.assertTrue(payload['audio']['url'])
                self.assertEqual(len(payload['audio']['segments']), 1)
                self.assertEqual(payload['audio']['segments'][0]['start_frame'], 5)
                first_clip_id = payload['audio']['segments'][0]['id']

                response = client.post(
                    upload_url,
                    data={
                        'audio': SimpleUploadedFile(
                            'effect.wav',
                            _make_wav_bytes(duration_seconds=0.5),
                            content_type='audio/wav',
                        ),
                        'start_frame': 12,
                    },
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertEqual(len(payload['audio']['segments']), 2)
                self.assertTrue(payload.get('selected_segment_id'))

                response = client.get(detail_url)
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertEqual(payload['audio']['start_frame'], 5)
                self.assertTrue(payload['audio']['has_audio'])
                self.assertEqual(len(payload['audio']['segments']), 2)
                first_segment = payload['audio']['segments'][0]
                second_segment = payload['audio']['segments'][1]

                update_url = reverse('animation:project_update', kwargs={'pk': project.pk})
                response = client.post(
                    update_url,
                    data=json.dumps({
                        'main_audio_segments': [
                            {
                                'id': first_segment['id'],
                                'start_frame': 3,
                                'frame_length': 6,
                                'source_start_seconds': 0.0,
                                'source_duration_seconds': 0.5,
                                'file_name': first_segment['file_name'],
                                'filename': first_segment['filename'],
                                'duration_seconds': first_segment['duration_seconds'],
                            },
                            {
                                'id': second_segment['id'],
                                'start_frame': 8,
                                'frame_length': 12,
                                'source_start_seconds': 0.0,
                                'source_duration_seconds': second_segment['duration_seconds'],
                                'file_name': second_segment['file_name'],
                                'filename': second_segment['filename'],
                                'duration_seconds': second_segment['duration_seconds'],
                            },
                        ],
                    }),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertEqual(len(payload['project']['audio']['segments']), 2)
                self.assertEqual(payload['project']['audio']['segments'][0]['start_frame'], 3)
                self.assertEqual(payload['project']['audio']['segments'][1]['start_frame'], 8)
                self.assertEqual(payload['project']['audio']['segments'][0]['row'], 0)
                self.assertEqual(payload['project']['audio']['segments'][1]['row'], 1)

                project_save_url = reverse('animation:project_save', kwargs={'pk': project.pk})
                response = client.post(
                    project_save_url,
                    data=json.dumps({
                        'frames': [],
                        'main_audio_segments': payload['project']['audio']['segments'],
                    }),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                save_payload = response.json()
                self.assertTrue(save_payload.get('ok'))
                self.assertEqual(len(save_payload['audio']['segments']), 2)

                response = client.delete(
                    detail_url,
                    data=json.dumps({'clip_id': first_clip_id}),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload.get('ok'))
                self.assertTrue(payload['audio']['has_audio'])
                self.assertEqual(len(payload['audio']['segments']), 1)

                project.refresh_from_db()
                self.assertEqual(len(project.main_audio_segments), 1)
