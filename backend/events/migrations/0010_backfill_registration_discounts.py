from django.db import migrations


def copy_payment_discounts(apps, schema_editor):
    Registration = apps.get_model("events", "Registration")
    Payment = apps.get_model("payments", "Payment")

    payments = (
        Payment.objects.exclude(discount_code__isnull=True)
        .select_related("discount_code")
        .order_by("id")
    )
    for payment in payments:
        registration = (
            Registration.objects.filter(event_id=payment.event_id, user_id=payment.user_id)
            .order_by("-registered_at")
            .first()
        )
        if not registration:
            continue

        updated_fields = []
        if payment.discount_code_id and not registration.discount_code_id:
            registration.discount_code_id = payment.discount_code_id
            updated_fields.append("discount_code")
        if payment.discount_amount and not registration.discount_amount:
            registration.discount_amount = payment.discount_amount
            updated_fields.append("discount_amount")
        if payment.amount is not None and registration.final_price is None:
            registration.final_price = payment.amount
            updated_fields.append("final_price")

        if updated_fields:
            registration.save(update_fields=updated_fields)

        if payment.registration_id is None:
            payment.registration_id = registration.id
            payment.save(update_fields=["registration"])


def reverse_copy_payment_discounts(apps, schema_editor):
    # No-op for reverse; data retention preferred.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0003_payment_registration"),
        ("events", "0009_registration_discount_amount_and_more"),
    ]

    operations = [
        migrations.RunPython(copy_payment_discounts, reverse_copy_payment_discounts),
    ]
