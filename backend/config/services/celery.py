"""Celery application configuration and scheduling."""

import os

from celery import Celery
from celery.schedules import crontab
from decouple import config

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.update(
    broker_url=config('REDIS_URL', default='redis://localhost:6379/0'),
    result_backend=config('REDIS_URL', default='redis://localhost:6379/0'),
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,
    task_soft_time_limit=60,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

app.conf.beat_schedule = {
    'send-event-reminders': {
        'task': 'communications.tasks.send_event_reminders',
        'schedule': crontab(minute=0, hour='*/1'),
        'description': 'Runs hourly to notify about upcoming events.',
    },
    'send-weekly-newsletter': {
        'task': 'communications.tasks.send_weekly_newsletter',
        'schedule': crontab(hour=9, minute=0, day_of_week=1),
        'description': 'Runs every Monday at 09:00 UTC.',
    },
    'cleanup-expired-tokens': {
        'task': 'communications.tasks.cleanup_expired_tokens',
        'schedule': crontab(hour=2, minute=0),
        'description': 'Runs daily at 02:00 UTC.',
    },
    'process-scheduled-announcements': {
        'task': 'communications.tasks.process_scheduled_announcements',
        'schedule': crontab(minute='*/15'),
        'description': 'Runs every 15 minutes to dispatch scheduled announcements.',
    },
}

EMAIL_TIMEOUT_SECONDS = 10

CELERY_TASK_SOFT_TIME_LIMIT = 20
CELERY_TASK_TIME_LIMIT = 30
