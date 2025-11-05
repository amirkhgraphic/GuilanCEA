from ninja import Router

from django.db import connection
from django.utils import timezone

health_router = Router()

@health_router.get("/health")
def health(request):
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1;")
        return {"status": "ok", "time": timezone.now().isoformat()}
    except Exception as e:
        return  {"status": "error", "error": str(e)}, 500
