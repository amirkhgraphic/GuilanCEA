from django.contrib import admin

from .models import CertificateTemplate, Skill, UserCertificate


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    search_fields = ('name',)


@admin.register(CertificateTemplate)
class CertificateTemplateAdmin(admin.ModelAdmin):
    list_display = ('event', 'created_at')
    search_fields = ('event__title',)
    filter_horizontal = ('skills',)


@admin.register(UserCertificate)
class UserCertificateAdmin(admin.ModelAdmin):
    list_display = ('user', 'event', 'title', 'score', 'issued_at')
    list_filter = ('score', 'issued_at')
    search_fields = ('user__username', 'title', 'event__title')
    filter_horizontal = ('skills',)
