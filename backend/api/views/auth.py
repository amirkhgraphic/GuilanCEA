from typing import List

from django.conf import settings
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

import uuid
import jwt
from ninja import Router

from users.models import User
from users.tasks import send_verification_email, send_password_reset_email
from api.authentication import create_jwt_token, create_refresh_token, jwt_auth
from api.schemas import (
    UserRegistrationSchema, UserLoginSchema, UserProfileSchema,
    UserUpdateSchema, TokenSchema, TokenRefreshIn, MessageSchema, ErrorSchema,
    PasswordResetRequestSchema, PasswordResetConfirmSchema, UsernameCheckSchema
)

auth_router = Router()

@auth_router.post("/register", response={201: MessageSchema, 400: ErrorSchema})
def register(request, data: UserRegistrationSchema):
    """Register a new user"""
    try:
        if data.student_id and len(str(data.student_id)) < 10:
            return 400, {"error": "کد دانشجویی معتبر نیست."}

        # Check if user already exists
        if User.objects.filter(username=data.username).exists():
            return 400, {"error": "نام کاربری قبلاً استفاده شده است."}
        
        if User.objects.filter(email=data.email).exists():
            return 400, {"error": "ایمیل قبلاً استفاده شده است."}

        if data.student_id and User.objects.filter(university=data.university, student_id=data.student_id).exists():
            return 400, {"error": "کاربری با این کد دانشجویی در این دانشگاه ثبت شده است."}

        # Create user
        User.objects.create_user(
            username=data.username,
            email=data.email,
            password=data.password,
            student_id=data.student_id,
            first_name=data.first_name or "",
            last_name=data.last_name or "",
            year_of_study=data.year_of_study,
            major=data.major or "",
            university=data.university or "",
        )
        
        return 201, {"message": "حساب شما با موفقیت ایجاد شد. برای ادامه، ابتدا ایمیل خود را تأیید کنید."}

    except Exception as e:
        return 400, {"error": "خطایی رخ داده است. لطفاً با پشتیبانی تماس بگیرید.", "details": str(e)}

@auth_router.post("/login", response={200: TokenSchema, 401: ErrorSchema})
def login(request, data: UserLoginSchema):
    """Login user and return JWT tokens"""
    user = authenticate(email=data.email, password=data.password)
    
    if not user:
        return 401, {"error": "ایمیل یا رمز عبور نادرست است."}
    
    if not user.is_email_verified:
        return 401, {"error": "برای ورود، ابتدا ایمیل خود را تأیید کنید."}
    
    if not user.is_active:
        return 401, {"error": "حساب کاربری شما غیرفعال است."}
    
    access_token = create_jwt_token(user)
    refresh_token = create_refresh_token(user)
    
    return 200, {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@auth_router.post("/refresh", response={200: TokenSchema, 401: ErrorSchema})
def refresh_tokens(request, data: TokenRefreshIn):
    """Exchange a valid refresh token for a new access (and refresh) token."""
    try:
        payload = jwt.decode(
            data.refresh_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "refresh":
            return 401, {"error": "نوع توکن نامعتبر است."}

        user_id = payload.get("user_id")
        if not user_id:
            return 401, {"error": "داده‌های توکن نامعتبر است."}

        user = get_object_or_404(User, id=user_id)

        if not user.is_email_verified:
            return 401, {"error": "برای استفاده، ابتدا ایمیل خود را تأیید کنید."}
    
        if not user.is_active:
            return 401, {"error": "حساب کاربری شما غیرفعال است."}

    except jwt.ExpiredSignatureError:
        return 401, {"error": "رفرش‌توکن منقضی شده است."}
    
    except jwt.InvalidTokenError:
        return 401, {"error": "رفرش‌توکن نامعتبر است."}

    access_token = create_jwt_token(user)
    refresh_token = create_refresh_token(user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@auth_router.get("/verify-email/{token}", response={200: MessageSchema, 400: ErrorSchema})
def verify_email(request, token: str):
    """Verify user email with token"""
    try:
        user = get_object_or_404(User, email_verification_token=token)
        
        if user.is_email_verified:
            return 400, {"error": "ایمیل قبلاً تأیید شده است."}
        
        user.is_email_verified = True
        user.save(update_fields=['is_email_verified'])
        
        return 200, {"message": "ایمیل شما با موفقیت تأیید شد."}
        
    except User.DoesNotExist:
        return 400, {"error": "توکن تأیید نامعتبر است."}

@auth_router.post("/resend-verification", response={200: MessageSchema, 400: ErrorSchema})
def resend_verification(request, email: str):
    """Resend verification email"""
    try:
        user = get_object_or_404(User, email=email)
        
        if user.is_email_verified:
            return 400, {"error": "ایمیل قبلاً تأیید شده است."}
        
        # Generate new token
        user.regenerate_verification_token()
        user.email_verification_sent_at = timezone.now()
        user.save(update_fields=['email_verification_sent_at'])
        
        # Send verification email
        verification_url = f"{settings.FRONTEND_ROOT}verify-email/{user.email_verification_token}"
        send_verification_email.delay(user.id, verification_url)
        
        return 200, {"message": "ایمیل تأیید برای شما ارسال شد."}
        
    except User.DoesNotExist:
        return 400, {"error": "کاربر یافت نشد."}

@auth_router.get("/profile", response=UserProfileSchema, auth=jwt_auth)
def get_profile(request):
    """Get current user profile"""
    return request.auth

@auth_router.put("/profile", response={200: UserProfileSchema, 400: ErrorSchema}, auth=jwt_auth)
def update_profile(request, data: UserUpdateSchema):
    """Update current user profile"""
    user = request.auth
    
    for field, value in data.dict(exclude_unset=True).items():
        setattr(user, field, value)
    
    user.save()
    return 200, user

@auth_router.post("/profile/picture", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def upload_profile_picture(request):
    """Upload profile picture"""
    if 'file' not in request.FILES:
        return 400, {"error": "فایلی ارسال نشده است."}
    
    file = request.FILES['file']
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        return 400, {"error": "فایل باید از نوع تصویر باشد."}
    
    # Validate file size (5MB max)
    if file.size > 5 * 1024 * 1024:
        return 400, {"error": "حجم فایل باید کمتر از ۵ مگابایت باشد."}
    
    user = request.auth
    
    # Delete old profile picture if exists
    if user.profile_picture:
        default_storage.delete(user.profile_picture.name)
    
    # Save new profile picture
    filename = f"profile_pictures/{user.id}_{uuid.uuid4().hex}.{file.name.split('.')[-1]}"
    user.profile_picture.save(filename, ContentFile(file.read()))
    
    return 200, {"message": "تصویر پروفایل با موفقیت به‌روزرسانی شد."}

@auth_router.delete("/profile/picture", response={200: MessageSchema}, auth=jwt_auth)
def delete_profile_picture(request):
    """Delete current user's profile picture"""
    user = request.auth
    
    if user.profile_picture:
        default_storage.delete(user.profile_picture.name)
        user.profile_picture = None
        user.save(update_fields=['profile_picture'])
    
    return 200, {"message": "تصویر پروفایل با موفقیت حذف شد."}

@auth_router.post("/request-password-reset", response={200: MessageSchema, 400: ErrorSchema})
def request_password_reset(request, data: PasswordResetRequestSchema):
    """Request a password reset email"""
    try:
        user = get_object_or_404(User, email=data.email)
        user.set_password_reset_token()

        reset_url = f"{settings.FRONTEND_PASSWORD_RESET_PAGE}/{user.password_reset_token}"
        send_password_reset_email.delay(user.id, reset_url)

        # پیام عمومیِ یکسان برای جلوگیری از افشای وجود/عدم وجود ایمیل
        return 200, {"message": "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازنشانی رمز عبور ارسال خواهد شد."}

    except User.DoesNotExist:
        return 200, {"message": "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازنشانی رمز عبور ارسال خواهد شد."}

    except Exception as e:
        return 400, {"error": "درخواست بازنشانی رمز عبور انجام نشد.", "details": str(e)}

@auth_router.post("/reset-password-confirm", response={200: MessageSchema, 400: ErrorSchema})
def reset_password_confirm(request, data: PasswordResetConfirmSchema):
    """Confirm password reset with token and new password"""
    try:
        user = get_object_or_404(User, password_reset_token=data.token)

        if user.password_reset_token_expires_at < timezone.now():
            user.password_reset_token = None
            user.password_reset_token_expires_at = None
            user.save(update_fields=['password_reset_token', 'password_reset_token_expires_at'])
            return 400, {"error": "زمان استفاده از لینک تغییر رمز عبور به پایان رسیده است. لطفاً دوباره اقدام کنید."}

        user.set_password(data.new_password)
        user.password_reset_token = None
        user.password_reset_token_expires_at = None
        user.save(update_fields=['password', 'password_reset_token', 'password_reset_token_expires_at'])

        return 200, {"message": "رمز عبور شما با موفقیت تغییر کرد."}

    except User.DoesNotExist:
        return 400, {"error": "توکن بازنشانی رمز عبور نامعتبر یا منقضی شده است."}

    except Exception as e:
        return 400, {"error": "تغییر رمز عبور انجام نشد.", "details": str(e)}

@auth_router.get("/users/deleted", response=List[UserProfileSchema], auth=jwt_auth)
def list_deleted_users(request):
    """List all soft-deleted users (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "اجازه دسترسی ندارید."}

    return User.deleted_objects.all()  # Use the 'dead' manager to get only deleted users

@auth_router.post("/users/{user_id}/restore", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def restore_user(request, user_id: int):
    """Restore a soft-deleted user (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "اجازه دسترسی ندارید."}

    try:
        user = User.deleted_objects.get(id=user_id)
        user.restore()
        return 200, {"message": f"کاربر {user.username} با موفقیت بازیابی شد."}
    except User.DoesNotExist:
        return 400, {"error": "کاربر یافت نشد یا حذف نرم نشده است."}
    except Exception as e:
        return 400, {"error": "بازیابی کاربر انجام نشد.", "details": str(e)}

@auth_router.get("/check-username", response=UsernameCheckSchema)
def check_username_availability(request, username: str):
    """Check if a username is available for registration"""
    exists = User.objects.filter(username=username).exists()
    return {"exists": exists}
