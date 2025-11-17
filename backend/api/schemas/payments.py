from ninja import Schema


class CreatePaymentIn(Schema):
    event_id: int
    description: str
    discount_code: str | None = None
    mobile: str | None = None
    email:  str | None = None


class CreatePaymentOut(Schema):
    start_pay_url: str | None = None
    authority: str | None = None
    base_amount: int
    discount_amount: int
    amount: int

class PaymentDetailOut(Schema):
    ref_id: str | None = None
    authority: str | None = None
    base_amount: int
    discount_amount: int
    amount: int
    status: str
    verified_at: str | None = None
    event: dict

class CouponVerifyIn(Schema):
    event_id: int
    code: str

class CouponVerifyOut(Schema):
    discount_amount: int
    final_price: int
