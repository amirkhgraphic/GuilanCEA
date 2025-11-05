from decouple import config

ZARINPAL_MERCHANT_ID = config('ZARINPAL_MERCHANT_ID', default='')
ZARINPAL_USE_SANDBOX = config('ZARINPAL_USE_SANDBOX', default=False, cast=bool)

ZARINPAL_API_BASE = "https://sandbox.zarinpal.com" if ZARINPAL_USE_SANDBOX else "https://payment.zarinpal.com"
ZARINPAL_REQUEST_URL = f"{ZARINPAL_API_BASE}/pg/v4/payment/request.json"
ZARINPAL_VERIFY_URL  = f"{ZARINPAL_API_BASE}/pg/v4/payment/verify.json"
ZARINPAL_STARTPAY    = f"{ZARINPAL_API_BASE}/pg/StartPay/"
ZARINPAL_CALLBACK_URL = config('ZARINPAL_CALLBACK_URL', default='http://localhost:8000/api/payments/callback')
