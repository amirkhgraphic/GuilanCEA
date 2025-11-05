from django.contrib import admin, messages
from django.utils.translation import gettext_lazy as _
from django.db import transaction
from django.db.models.deletion import ProtectedError

from unfold.admin import ModelAdmin

class SoftDeleteListFilter(admin.SimpleListFilter):
    title = _('Soft Delete Status')
    parameter_name = 'is_deleted'

    def lookups(self, request, model_admin):
        return [
            ('0', _('Active')),
            ('1', _('Deleted')),
        ]

    def queryset(self, request, queryset):
        if self.value() == '0':
            return queryset.filter(is_deleted=False)

        if self.value() == '1':
            return queryset.model.deleted_objects.all()

        return queryset


class BaseModelAdmin(ModelAdmin):
    actions = ["hard_delete_selected", "restore_selected"]

    def get_queryset(self, request):
        return self.model.all_objects.all()

    @admin.action(description=_('Hard delete selected (permanent)'))
    def hard_delete_selected(self, request, queryset):
        """
        حذف فیزیکی رکوردهای انتخاب‌شده (دورزدن SoftDelete).
        """
        count = queryset.count()
        try:
            with transaction.atomic():
                queryset.hard_delete()
            self.message_user(
                request,
                _('%(count)d record(s) permanently deleted.') % {'count': count},
                level=messages.SUCCESS
            )
        except ProtectedError:
            self.message_user(
                request,
                _('Cannot hard delete because related protected objects exist.'),
                level=messages.ERROR
            )
        except Exception as e:
            self.message_user(request, str(e), level=messages.ERROR)

    @admin.action(description=_('Restore selected (undo soft delete)'))
    def restore_selected(self, request, queryset):
        """
        بازگردانی رکوردهای soft-deleted.
        """
        restored = 0
        for obj in queryset:
            if getattr(obj, "is_deleted", False):
                obj.restore()
                restored += 1
        self.message_user(
            request,
            _('%(count)d record(s) restored.') % {'count': restored},
            level=messages.SUCCESS
        )

    def get_actions(self, request):
        actions = super().get_actions(request)

        if not request.user.is_superuser:
            actions.pop("hard_delete_selected", None)

        is_deleted_filter = request.GET.get('is_deleted')
        if is_deleted_filter != '1':  # فقط در صفحهٔ Deleted نمایش restore
            actions.pop('restore_selected', None)
            actions.pop('hard_delete_selected', None)

        return actions
