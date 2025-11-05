from .base import *

DEBUG = True

# Additional development settings
INTERNAL_IPS = [
    "127.0.0.1",
]

# Email backend for development
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Disable caching in development
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}
