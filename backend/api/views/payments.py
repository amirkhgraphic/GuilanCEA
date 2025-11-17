from django.conf import settings
from django.shortcuts import redirect, get_object_or_404
from django.utils import timezone

from ninja import Router
from ninja.errors import HttpError
import requests

from payments.models import Payment, DiscountCode
from events.models import Event, Registration
from api.authentication import jwt_auth
from api.schemas.payments import CouponVerifyIn, CouponVerifyOut, CreatePaymentIn, CreatePaymentOut, PaymentDetailOut

payments_router = Router(tags=["Payments"])


@payments_router.post("create", response=CreatePaymentOut, auth=jwt_auth)
def create_payment(request, payload: CreatePaymentIn):
    event = get_object_or_404(Event, pk=payload.event_id)

    if Payment.objects.filter(status=Payment.OrderStatusChoices.PAID, user=request.auth, event=event).exists():
        raise HttpError(400, "You have already registered in this event")

    registration = (
        Registration.objects.filter(event=event, user=request.auth, is_deleted=False)
        .order_by("-registered_at")
        .first()
    )
    if not registration or registration.status == Registration.StatusChoices.CANCELLED:
        registration = Registration.objects.create(
            event=event,
            user=request.auth,
            status=Registration.StatusChoices.PENDING,
            final_price=event.price,
        )
    elif registration.final_price is None:
        registration.final_price = event.price
        registration.save(update_fields=["final_price"])

    discount_code = None
    discount_amount = 0
    final_amount = event.price

    if payload.discount_code:
        discount_code = DiscountCode.objects.filter(code=payload.discount_code, applicable_events=event, is_active=True).first()

        if discount_code:
            final_amount, discount_amount = discount_code.calculate_discount(event, request.auth)

    registration_updates = []
    if discount_code and registration.discount_code_id != discount_code.id:
        registration.discount_code = discount_code
        registration_updates.append("discount_code")
    if registration.discount_amount != discount_amount:
        registration.discount_amount = discount_amount
        registration_updates.append("discount_amount")
    if registration.final_price != final_amount:
        registration.final_price = final_amount
        registration_updates.append("final_price")

    if final_amount == 0:
        if registration.status != Registration.StatusChoices.CONFIRMED:
            registration.status = Registration.StatusChoices.CONFIRMED
            registration_updates.append("status")
        if registration_updates:
            registration.save(update_fields=list(set(registration_updates)))
        else:
            registration.save(update_fields=["status"])

        return {
            "start_pay_url": None,
            "authority": None,
            "base_amount": event.price,
            "discount_amount": discount_amount if discount_amount else 0,
            "amount": 0,
        }

    if registration_updates:
        registration.save(update_fields=list(set(registration_updates)))

    pay = Payment.objects.create(
        user=request.auth,
        event=event,
        base_amount=event.price,
        discount_code=discount_code,
        discount_amount=discount_amount,
        amount=final_amount,
        status=Payment.OrderStatusChoices.INIT,
        registration=registration,
    )

    callback_url = getattr(settings, "ZARINPAL_CALLBACK_URL", "http://localhost:8000/api/payments/callback")
    body = {
        "merchant_id": settings.ZARINPAL_MERCHANT_ID,
        "amount": final_amount,
        "callback_url": callback_url,
        "description": payload.description,
        "metadata": {
            k: v for k, v in {
                "mobile": payload.mobile,
                "email":  payload.email,
                "event_id": event.id,
                "user_id": request.auth.id,
                "payment_id": pay.id,
                "discount_code": discount_code.code if discount_code else None,
            }.items() if v
        }
    }

    try:
        response = requests.post(
            settings.ZARINPAL_REQUEST_URL,
            json=body,
            headers={"accept":"application/json","content-type":"application/json"},
            timeout=15
        )
        jd = response.json()
    except Exception as e:
        pay.delete()
        raise HttpError(502, f"Gateway request failed: {e}")

    code = (jd.get("data") or {}).get("code")
    if code != 100:
        pay.delete()
        raise HttpError(502, f"Zarinpal error: {jd.get('errors') or jd}")

    authority = jd["data"]["authority"]
    pay.authority = authority
    pay.status = Payment.OrderStatusChoices.PENDING
    pay.save(update_fields=["authority","status"])

    return {
        "start_pay_url": f"{settings.ZARINPAL_STARTPAY}{authority}",
        "authority": authority,
        "base_amount": event.price,
        "discount_amount": discount_amount if discount_amount else 0,
        "amount": final_amount,
    }

@payments_router.get("callback")
def callback(request, Authority: str | None = None, Status: str | None = None):
    if not Authority:
        raise HttpError(400, "Missing Authority")

    pay = Payment.objects.filter(authority=Authority).select_related("event","user","discount_code").first()
    if not pay:
        raise HttpError(404, "Payment not found")

    if Status != "OK":
        pay.status = Payment.OrderStatusChoices.CANCELED
        pay.save(update_fields=["status"])
        return redirect(f"{settings.FRONTEND_CALLBACK_URL}?status=failed&event_id={pay.event_id}")

    verify_body = {
        "merchant_id": settings.ZARINPAL_MERCHANT_ID,
        "amount": pay.amount,
        "authority": Authority,
    }

    try:
        vresp = requests.post(
            settings.ZARINPAL_VERIFY_URL,
            json=verify_body,
            headers={"accept":"application/json","content-type":"application/json"},
            timeout=15
        )
        vjd = vresp.json()
    except Exception:
        pay.status = Payment.OrderStatusChoices.FAILED
        pay.save(update_fields=["status"])
        return redirect(f"{settings.FRONTEND_CALLBACK_URL}?status=failed&event_id={pay.event_id}")

    vcode = (vjd.get("data") or {}).get("code")
    if vcode in (100, 101):
        data = vjd.get("data") or {}
        pay.status = Payment.OrderStatusChoices.PAID
        pay.ref_id = data.get("ref_id")
        pay.card_pan = data.get("card_pan")
        pay.card_hash = data.get("card_hash")
        pay.verified_at = timezone.now()
        pay.save(update_fields=["status", "ref_id", "card_pan", "card_hash", "verified_at"])

        registration = pay.registration or Registration.objects.filter(
            user=pay.user,
            event=pay.event,
            status=Registration.StatusChoices.PENDING,
        ).first()
        if registration:
            registration.status = Registration.StatusChoices.CONFIRMED
            updates = ["status"]
            if registration.final_price is None:
                registration.final_price = pay.amount
                updates.append("final_price")
            registration.save(update_fields=updates)

        return redirect(f"{settings.FRONTEND_CALLBACK_URL}?status=success&event_id={pay.event_id}&ref_id={pay.ref_id}")

    pay.status = Payment.OrderStatusChoices.FAILED
    pay.save(update_fields=["status"])
    return redirect(f"{settings.FRONTEND_CALLBACK_URL}?status=failed&event_id={pay.event_id}")

@payments_router.get("by-ref/{ref_id}", response=PaymentDetailOut)
def payment_by_ref(request, ref_id: str):
    pay = get_object_or_404(Payment.objects.select_related("event"), ref_id=ref_id)
    ev = pay.event
    return {
        "ref_id": pay.ref_id,
        "authority": pay.authority,
        "base_amount": pay.base_amount,
        "discount_amount": pay.discount_amount or 0,
        "amount": pay.amount,
        "status": pay.get_status_display(),
        "verified_at": pay.verified_at.isoformat() if pay.verified_at else None,
        "event": {
            "id": ev.id,
            "title": ev.title,
            "slug": ev.slug,
            "image_url": request.build_absolute_uri(ev.featured_image.url) if ev.featured_image else None,
            "success_markdown": ev.registration_success_markdown,
        },
    }

@payments_router.post("/coupon/check", response=CouponVerifyOut, auth=jwt_auth)
def check_coupon(request, payload: CouponVerifyIn):
    event = get_object_or_404(Event, id=payload.event_id)
    code = payload.code

    if not code:
        raise HttpError(404, "لطفا کد تخفیف را وارد کنید")

    try:
        c = DiscountCode.objects.get(code=code, applicable_events=event, is_active=True)
        final_price, disc = c.calculate_discount(event, request.auth)
        return {
            "discount_amount": disc, 
            "final_price": final_price,
        }

    except DiscountCode.DoesNotExist:
        raise HttpError(404, "کد تخفیف معتبر نیست")
