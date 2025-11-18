from ninja import Router

from api.views import *
from api.views import certificates_router

router = Router()

router.add_router("auth/", auth_router, tags=["Authentication"])
router.add_router("blog/", blog_router, tags=["Blog"])
router.add_router("gallery/", gallery_router, tags=["Gallery"])
router.add_router("events/", events_router, tags=["Events"])
router.add_router("communications/", communications_router, tags=["Communications"])
router.add_router("payments/", payments_router, tags=["Payments"])
router.add_router("certificates/", certificates_router, tags=["Certificates"])
router.add_router("meta/", meta_router, tags=["Meta"])
router.add_router("/", health_router, tags=["Health"])
