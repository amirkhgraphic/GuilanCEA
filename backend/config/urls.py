from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from ninja import NinjaAPI
from api.urls import router as api_router

api = NinjaAPI(
    title="CS Association API",
    version="1.0.0",
    description="API for University Computer Science Association",
)

api.add_router("", api_router)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api.urls),
    path("", include("django_prometheus.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
