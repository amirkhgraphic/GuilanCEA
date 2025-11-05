from ninja import Router

from utils.choices import MajorChoices, UniversityChoices

meta_router = Router(tags=['meta'])

@meta_router.get("/majors")
def list_majors(request):
    return [{"code": c.value, "label": c.label} for c in MajorChoices]

@meta_router.get("/universities")
def list_universities(request):
    return [{"code": u.value, "label": u.label} for u in UniversityChoices]
