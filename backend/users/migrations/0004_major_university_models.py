from django.db import migrations, models
import django.db.models.deletion

from utils.choices import MajorChoices, UniversityChoices


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_alter_user_university"),
    ]

    operations = [
        migrations.CreateModel(
            name="University",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("code", models.CharField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Major",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("code", models.CharField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.RenameField(
            model_name="user",
            old_name="major",
            new_name="legacy_major",
        ),
        migrations.RenameField(
            model_name="user",
            old_name="university",
            new_name="legacy_university",
        ),
        migrations.AlterField(
            model_name="user",
            name="legacy_major",
            field=models.CharField(
                blank=True,
                choices=MajorChoices.choices,
                editable=False,
                max_length=16,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="legacy_university",
            field=models.CharField(
                blank=True,
                choices=UniversityChoices.choices,
                editable=False,
                max_length=127,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="major",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="users.major",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="university",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="users.university",
            ),
        ),
    ]
