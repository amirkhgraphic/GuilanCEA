from django import forms
from django.utils import timezone
from django.conf import settings
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from import_export.admin import ImportExportModelAdmin
from simplemde.widgets import SimpleMDEEditor

from users.models import User
from users.resources import UserResource
from users.tasks import send_verification_email
from utils.admin import SoftDeleteListFilter, BaseModelAdmin


class UserAdminForm(forms.ModelForm):
    bio = forms.CharField(widget=SimpleMDEEditor(), required=False)

    class Meta:
        model = User
        fields = '__all__'

@admin.register(User)
class UserAdmin(BaseUserAdmin, BaseModelAdmin, ImportExportModelAdmin):
    form = UserAdminForm
    resource_class = UserResource
    list_display = ('email', 'username', 'university', 'is_email_verified', 'date_joined')
    list_filter = ('is_email_verified', 'university', 'is_staff', 'year_of_study', SoftDeleteListFilter)
    search_fields = ('email', 'username', 'student_id', 'first_name', 'last_name')
    ordering = ('-date_joined',)

    fieldsets = (
        ('Auth Credentials', {'fields': ('username', 'email', 'password')}),
        ('Personal info', {
            'fields': ('first_name', 'last_name', 'student_id', 'university', 'year_of_study', 'major', 'bio', 'profile_picture')
        }),
        ('Permissions', {
                'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions',),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        
        ('Email Verification', {
            'fields': ('is_email_verified', 'email_verification_token', 'email_verification_sent_at')
        }),
        ('Password Reset', {
            'fields': ('password_reset_token', 'password_reset_token_expires_at'),
            'classes': ('collapse',)
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )
    add_fieldsets = (
        (
            'Step 1',
            {
                'classes': ('wide',),
                'fields': ('email', 'student_id', 'password1', 'password2', 'usable_password'),
            },
        ),
    )

    readonly_fields = ('email_verification_token', 'email_verification_sent_at', 'deleted_at',
                       'password_reset_token', 'password_reset_token_expires_at')
    
    actions = BaseModelAdmin.actions + [
        'verify_emails', 
        'resend_verification_email',
    ]
    
    @admin.action(description='Verify selected user emails')
    def verify_emails(self, request, queryset):
        queryset.update(is_email_verified=True)
        self.message_user(request, f'Verified {queryset.count()} user emails.')

    @admin.action(description="Resend verification email")
    def resend_verification_email(self, request, queryset):
        qs = queryset.filter(is_email_verified=False).exclude(email__isnull=True).exclude(email="")

        total = queryset.count()
        to_send = qs.count()
        skipped = total - to_send
        sent = failed = 0

        for user in qs:
            try:
                user.regenerate_verification_token()
                user.email_verification_sent_at = timezone.now()
                user.save(update_fields=["email_verification_sent_at"])

                verification_url = f"{settings.FRONTEND_ROOT}verify-email/{user.email_verification_token}"
                send_verification_email.delay(user.id, verification_url)
                sent += 1
            except Exception as exc:
                failed += 1

        if sent:
            self.message_user(request, f"ایمیل تأیید برای {sent} کاربر ارسال شد.", level=messages.SUCCESS)
        if skipped:
            self.message_user(
                request,
                f"{skipped} کاربر کنار گذاشته شدند (یا قبلاً تأیید شده‌اند یا ایمیل ندارند).",
                level=messages.WARNING,
            )
        if failed:
            self.message_user(request, f"ارسال برای {failed} کاربر با خطا مواجه شد.", level=messages.ERROR)
