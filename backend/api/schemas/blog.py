"""Blog API schemas."""

from ninja import Schema, ModelSchema
from typing import Optional, List
from datetime import datetime

from blog.models import Category, Tag, Comment


class CategorySchema(ModelSchema):
    class Config:
        model = Category
        model_fields = ['id', 'name', 'slug', 'description']

class TagSchema(ModelSchema):
    class Config:
        model = Tag
        model_fields = ['id', 'name', 'slug']

class AuthorSchema(Schema):
    id: int
    username: str
    first_name: str
    last_name: str
    profile_picture: Optional[str] = None

    @staticmethod
    def resolve_profile_picture(obj, context):
        request = context['request']
        if obj.profile_picture and hasattr(obj.profile_picture, 'url'):
            return request.build_absolute_uri(obj.profile_picture.url)
        return None

class PostListSchema(Schema):
    id: int
    title: str
    slug: str
    excerpt: str
    author: AuthorSchema
    featured_image: Optional[str] = None
    status: str
    published_at: Optional[datetime] = None
    category: Optional[CategorySchema] = None
    tags: List[TagSchema]
    is_featured: bool
    created_at: datetime
    reading_time: int

class PostDetailSchema(PostListSchema):
    content: str
    content_html: str

class PostCreateSchema(Schema):
    title: str
    content: str
    excerpt: Optional[str] = None
    category_id: Optional[int] = None
    tag_ids: Optional[List[int]] = []
    status: str = "draft"
    is_featured: bool = False

class CommentSchema(ModelSchema):
    author: AuthorSchema
    replies: List['CommentSchema'] = []
    post_id: int
    post_title: str
    post_slug: str

    class Config:
        model = Comment
        model_fields = ['id', 'content', 'created_at', 'is_approved']

    @staticmethod
    def resolve_post_id(obj):
        return obj.post_id

    @staticmethod
    def resolve_post_title(obj):
        return obj.post.title

    @staticmethod
    def resolve_post_slug(obj):
        return obj.post.slug

class CommentCreateSchema(Schema):
    content: str
    parent_id: Optional[int] = None
