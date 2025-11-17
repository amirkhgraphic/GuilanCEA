from ninja import Router

from users.models import Major, University

meta_router = Router(tags=['meta'])

@meta_router.get("/majors")
def list_majors(request):
    majors = Major.objects.filter(is_deleted=False, is_active=True).order_by("name")
    return [{"id": m.id, "code": m.code, "label": m.name} for m in majors]

@meta_router.get("/universities")
def list_universities(request):
    universities = University.objects.filter(is_deleted=False, is_active=True).order_by("name")
    return [{"id": u.id, "code": u.code, "label": u.name} for u in universities]
