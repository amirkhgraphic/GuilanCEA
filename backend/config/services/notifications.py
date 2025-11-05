from decouple import config

# Added VAPID configuration for web push notifications
# VAPID Configuration for Web Push Notifications
VAPID_PUBLIC_KEY = config('VAPID_PUBLIC_KEY', default='')
VAPID_PRIVATE_KEY = config('VAPID_PRIVATE_KEY', default='')
VAPID_CLAIMS = {
    "sub": config('VAPID_SUBJECT', default='mailto:admin@csassociation.com')
}

# Site URL for push notification links
SITE_URL = config('SITE_URL', default='http://localhost:8000')
