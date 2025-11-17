from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0005_populate_major_university"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="legacy_major",
        ),
        migrations.RemoveField(
            model_name="user",
            name="legacy_university",
        ),
    ]
