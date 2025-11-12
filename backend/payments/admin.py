from django.contrib import admin

from import_export.admin import ImportExportModelAdmin

from utils.admin import SoftDeleteListFilter, BaseModelAdmin
from payments.resources import DiscountResource, PaymentResource
from payments.models import Payment, DiscountCode


@admin.register(DiscountCode)
class DiscountCodeAdmin(BaseModelAdmin, ImportExportModelAdmin):
    resource_class = DiscountResource
    
    list_display = (
        'code', 'type', 'value', 'is_active', 'starts_at', 'ends_at',
        'usage_limit_total', 'usage_limit_per_user', 'min_amount', 'is_deleted'
    )
    list_filter = (
        'type', 'is_active', 'starts_at', 'ends_at', 'applicable_events',
        SoftDeleteListFilter,
    )
    search_fields = ('code', )
    readonly_fields = ('id', 'deleted_at', 'created_at', 'updated_at')

    fieldsets = (
        ('Discount Code Details', {
            'fields': ('code', 'type', 'value', 'applicable_events', 'is_active')
        }),
        ('Limitations', {
            'fields': ('starts_at', 'ends_at', 'usage_limit_total', 'usage_limit_per_user', 'min_amount')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ('deleted_at', )

    actions = BaseModelAdmin.actions + [
        'deactivate_codes',
    ]

    @admin.action(description="Deactivate selected discount codes")
    def deactivate_codes(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f"Deactivate {queryset.count()} discount codes.")

@admin.register(Payment)
class PaymentAdmin(BaseModelAdmin, ImportExportModelAdmin):
    resource_class = PaymentResource
    
    list_display = (
        'id', 'user', 'event', 'base_amount', 'discount_code', 'discount_amount', 'amount',
        'status', 'created_at', 'verified_at', 'is_deleted'
    )
    list_filter = (
        'status', 'event', 'user', 'discount_code',
        SoftDeleteListFilter,
    )
    search_fields = (
        'user__email', 'authority', 'ref_id', 'discount_code__code'
    )
    readonly_fields = (
        'user', 'event', 'base_amount', 'discount_code', 'discount_code', 'discount_amount', 'amount', 'authority',
        'status', 'ref_id', 'card_pan', 'card_hash', 'created_at', 'updated_at', 'deleted_at'
    )

    fieldsets = (
        ('Payment Details', {
            'fields': ('user', 'event', 'status', 'created_at', 'updated_at')
        }),
        ('Price Info', {
            'fields': ('base_amount', 'discount_code', 'discount_amount', 'amount')
        }),
        ('Others', {
            'fields': ('authority', 'ref_id', 'card_pan', 'card_hash')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )
