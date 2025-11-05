from django.conf import settings
from django.templatetags.static import static

# Django Unfold Configuration
UNFOLD = {
    "SITE_TITLE": "GuilanCE Association Admin",
    "SITE_HEADER": "GuilanCE Association",
    "SITE_URL": "/",
    "SITE_ICON": lambda request: static("img/logo.png"),
    # "SITE_LOGO": lambda request: static("img/logo.png"),
    "SITE_SYMBOL": "speed",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    # "SHOW_BACK_BUTTON": True,
    "ENVIRONMENT": "config.services.unfold.environment_callback",
    "LOGIN": {
        "image": lambda request: request.build_absolute_uri("/static/images/login-bg.jpg"),
        "redirect_after": lambda request: request.build_absolute_uri("/admin/"),
    },
    "STYLES": [
        lambda request: request.build_absolute_uri("/static/css/styles.css"),
    ],
    "SCRIPTS": [
        lambda request: request.build_absolute_uri("/static/js/scripts.js"),
    ],
    "COLORS": {
        "primary": {
            "50": "250 245 255",
            "100": "243 232 255",
            "200": "233 213 255",
            "300": "216 180 254",
            "400": "196 144 254",
            "500": "168 85 247",
            "600": "147 51 234",
            "700": "126 34 206",
            "800": "107 33 168",
            "900": "88 28 135",
        },
    },
    "EXTENSIONS": {
        "modeltranslation": {
            "flags": {
                "en": "🇺🇸",
                "fa": "🇮🇷",
            },
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": True,
        "navigation": [
            {
                "title": "Navigation",
                "separator": True,
                "items": [
                    {
                        "title": "Dashboard",
                        "icon": "dashboard",
                        "link": lambda request: request.build_absolute_uri("/admin/"),
                        # "badge": 3
                    },
                    {
                        "title": "Users",
                        "icon": "account_circle",
                        "link": lambda request: request.build_absolute_uri("/admin/users/user/"),
                    },
                    {
                        "title": "Blog",
                        "icon": "post",
                        "link": lambda request: request.build_absolute_uri("/admin/blog/"),
                    },
                    {
                        "title": "Events",
                        "icon": "event",
                        "link": lambda request: request.build_absolute_uri("/admin/events/"),
                    },
                    {
                        "title": "Gallery",
                        "icon": "filter",
                        "link": lambda request: request.build_absolute_uri("/admin/gallery/gallery/"),
                    },
                    {
                        "title": "Communications",
                        "icon": "call",
                        "link": lambda request: request.build_absolute_uri("/admin/communications/"),
                    },
                ],
            },
        ],
    },
}

def environment_callback(request):
    return ["Development", "warning"] if settings.DEBUG else ["Production", "success"]
