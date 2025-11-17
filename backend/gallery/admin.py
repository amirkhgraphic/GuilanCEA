from django.contrib import admin
from django.utils.html import format_html

from import_export.admin import ImportExportModelAdmin

from gallery.models import Gallery
from gallery.resources import GalleryResource
from utils.admin import SoftDeleteListFilter, BaseModelAdmin

@admin.register(Gallery)
class GalleryAdmin(BaseModelAdmin, ImportExportModelAdmin):
    resource_class = GalleryResource
    list_display = ('title', 'image_preview', 'uploaded_by', 'file_size_display', 'dimensions', 'is_public', 'created_at')
    list_filter = ('is_public', 'created_at', SoftDeleteListFilter)
    search_fields = ('title', 'description', 'alt_text')
    readonly_fields = ('uploaded_by', 'file_size', 'width', 'height', 'image_preview_large', 'markdown_url')
    
    fieldsets = (
        ('Image Info', {
            'fields': ('title', 'description', 'image', 'alt_text', 'is_public')
        }),
        ('Uploader', {
            'fields': ('uploaded_by',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('file_size', 'width', 'height'),
            'classes': ('collapse',)
        }),
        ('Preview & Usage', {
            'fields': ('image_preview_large', 'markdown_url'),
            'classes': ('collapse',)
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = BaseModelAdmin.actions + ['make_public', 'make_private', 'restore_images']
    
    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />',
                obj.image.url
            )
        return "No Image"
    image_preview.short_description = "Preview"
    
    def image_preview_large(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="max-width: 300px; max-height: 300px; object-fit: contain;" />',
                obj.image.url
            )
        return "No Image"
    image_preview_large.short_description = "Image Preview"
    
    def file_size_display(self, obj):
        return f"{obj.file_size_mb} MB" if obj.file_size else "Unknown"
    file_size_display.short_description = "File Size"
    
    def dimensions(self, obj):
        if obj.width and obj.height:
            return f"{obj.width} × {obj.height}"
        return "Unknown"
    dimensions.short_description = "Dimensions"
    
    def make_public(self, request, queryset):
        queryset.update(is_public=True)
        self.message_user(request, f"Made {queryset.count()} images public.")
    make_public.short_description = "Make selected images public"
    
    def make_private(self, request, queryset):
        queryset.update(is_public=False)
        self.message_user(request, f"Made {queryset.count()} images private.")
    make_private.short_description = "Make selected images private"
    
    def restore_images(self, request, queryset):
        for image in queryset:
            image.restore()
        self.message_user(request, f"Restored {queryset.count()} images.")
    restore_images.short_description = "Restore selected images"

    def save_model(self, request, obj, form, change):
        if not obj.uploaded_by_id:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)
