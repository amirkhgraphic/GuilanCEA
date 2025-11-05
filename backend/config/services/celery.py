import os
from decouple import config
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('config')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Configuration
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

# Celery Beat configuration
app.conf.beat_schedule = {
    'send-event-reminders': {
        'task': 'communications.tasks.send_event_reminders',
        'schedule': crontab(minute=0, hour='*/1'),  # Every hour
    },
    'send-weekly-newsletter': {
        'task': 'communications.tasks.send_weekly_newsletter',
        'schedule': crontab(hour=9, minute=0, day_of_week=1),  # Monday at 9 AM
    },
    'cleanup-expired-tokens': {
        'task': 'communications.tasks.cleanup_expired_tokens',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
    },
    'process-scheduled-announcements': {
        'task': 'communications.tasks.process_scheduled_announcements',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
}

EMAIL_TIMEOUT = 10  # seconds

# Celery time limits so tasks don’t hang forever
CELERY_TASK_SOFT_TIME_LIMIT = 20
CELERY_TASK_TIME_LIMIT = 30
