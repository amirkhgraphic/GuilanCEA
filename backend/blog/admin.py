from django import forms
from django.contrib import admin

from import_export.admin import ImportExportModelAdmin
from simplemde.widgets import SimpleMDEEditor

from blog.models import Category, Tag, Post, Comment, Like
from blog.resources import PostResource, CategoryResource
from utils.admin import SoftDeleteListFilter, BaseModelAdmin

@admin.register(Category)
class CategoryAdmin(BaseModelAdmin, ImportExportModelAdmin):
    resource_class = CategoryResource
    list_display = ('name', 'slug', 'created_at', 'is_deleted')
    list_filter = ('created_at', 'is_deleted', SoftDeleteListFilter)
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at', 'deleted_at')

    fieldsets = (
        ('Content', {
            'fields': ('name', 'slug', 'description')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        })
    )
    actions = BaseModelAdmin.actions + ['restore_categories']
    
    def restore_categories(self, request, queryset):
        for category in queryset:
            category.restore()
        self.message_user(request, f"Restored {queryset.count()} categories.")
    restore_categories.short_description = "Restore selected categories"

@admin.register(Tag)
class TagAdmin(BaseModelAdmin, ImportExportModelAdmin):
    list_display = ('name', 'slug', 'created_at', 'is_deleted')
    list_filter = ('created_at', 'is_deleted', SoftDeleteListFilter)
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at', 'deleted_at')

    fieldsets = (
        ('Content', {
            'fields': ('name', 'slug')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        })
    )


class PostAdminForm(forms.ModelForm):
    content = forms.CharField(widget=SimpleMDEEditor())
    excerpt = forms.CharField(widget=SimpleMDEEditor())

    class Meta:
        model = Post
        fields = '__all__'


@admin.register(Post)
class PostAdmin(BaseModelAdmin, ImportExportModelAdmin):
    form = PostAdminForm
    resource_class = PostResource
    list_display = ('title', 'author', 'status', 'category', 'is_featured', 'published_at', 'created_at')
    list_filter = ('status', 'is_featured', 'category', 'tags', 'created_at', 'published_at', SoftDeleteListFilter)
    search_fields = ('title', 'content', 'author__username')
    prepopulated_fields = {'slug': ('title',)}
    filter_horizontal = ('tags',)
    date_hierarchy = 'published_at'
    
    fieldsets = (
        ('Content', {
            'fields': ('title', 'slug', 'content', 'excerpt', 'featured_image')
        }),
        ('Metadata', {
            'fields': ('author', 'category', 'tags', 'status', 'is_featured', 'published_at')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('deleted_at',)

    actions = BaseModelAdmin.actions + ['make_published', 'make_draft', 'make_featured', 'restore_posts']
    
    def make_published(self, request, queryset):
        queryset.update(status='published')
        self.message_user(request, f"Published {queryset.count()} posts.")
    make_published.short_description = "Mark selected posts as published"
    
    def make_draft(self, request, queryset):
        queryset.update(status='draft')
        self.message_user(request, f"Marked {queryset.count()} posts as draft.")
    make_draft.short_description = "Mark selected posts as draft"
    
    def make_featured(self, request, queryset):
        queryset.update(is_featured=True)
        self.message_user(request, f"Featured {queryset.count()} posts.")
    make_featured.short_description = "Mark selected posts as featured"
    
    def restore_posts(self, request, queryset):
        for post in queryset:
            post.restore()
        self.message_user(request, f"Restored {queryset.count()} posts.")
    restore_posts.short_description = "Restore selected posts"

@admin.register(Comment)
class CommentAdmin(BaseModelAdmin):
    list_display = ('author', 'post', 'content_preview', 'is_approved', 'created_at')
    list_filter = ('is_approved', 'created_at', 'post', SoftDeleteListFilter)
    search_fields = ('content', 'author__username', 'author__last_name', 'author__first_name', 'post__title')
    readonly_fields = ('content_preview', 'created_at', 'updated_at', 'deleted_at')

    fieldsets = (
        ('Content', {
            'fields': ('post', 'author', 'content')
        }),
        ('Metadata', {
            'fields': ('is_approved', 'created_at', 'updated_at')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        })
    )
    actions = BaseModelAdmin.actions + ['approve_comments', 'disapprove_comments']
    
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content Preview'
    
    def approve_comments(self, request, queryset):
        queryset.update(is_approved=True)
        self.message_user(request, f"Approved {queryset.count()} comments.")
    approve_comments.short_description = "Approve selected comments"
    
    def disapprove_comments(self, request, queryset):
        queryset.update(is_approved=False)
        self.message_user(request, f"Disapproved {queryset.count()} comments.")
    disapprove_comments.short_description = "Disapprove selected comments"

@admin.register(Like)
class LikeAdmin(BaseModelAdmin):
    list_display = ('user', 'post', 'created_at')
    list_filter = ('created_at', 'post')
    search_fields = ('user__username', 'post__title')
