from django.db import migrations

from utils.choices import MajorChoices, UniversityChoices


def seed_reference_models(apps, schema_editor):
    Major = apps.get_model("users", "Major")
    University = apps.get_model("users", "University")
    User = apps.get_model("users", "User")

    major_map = {}
    for code, label in MajorChoices.choices:
        obj, _ = Major.objects.update_or_create(
            code=code,
            defaults={"name": label},
        )
        major_map[code] = obj

    university_map = {}
    for code, label in UniversityChoices.choices:
        obj, _ = University.objects.update_or_create(
            code=code,
            defaults={"name": label},
        )
        university_map[code] = obj

    users = User.objects.all()
    for user in users.iterator():
        updates = []
        major_code = getattr(user, "legacy_major", None)
        if major_code:
            major = major_map.get(major_code)
            if major and user.major_id != major.id:
                user.major_id = major.id
                updates.append("major")

        university_code = getattr(user, "legacy_university", None)
        if university_code:
            uni = university_map.get(university_code)
            if uni and user.university_id != uni.id:
                user.university_id = uni.id
                updates.append("university")

        if updates:
            user.save(update_fields=updates)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_major_university_models"),
    ]

    operations = [
        migrations.RunPython(seed_reference_models, noop),
    ]
