from django.shortcuts import get_object_or_404
from django.db.models import Q, Prefetch

from ninja import Router, Query
from typing import List, Optional

from users.models import User
from blog.models import Post, Category, Tag, Comment, Like
from api.authentication import jwt_auth
from api.schemas import (
    PostListSchema, PostDetailSchema, PostCreateSchema,
    CategorySchema, TagSchema, CommentSchema, CommentCreateSchema,
    MessageSchema, ErrorSchema
)

blog_router = Router()

# Post endpoints
@blog_router.get("/posts", response=List[PostListSchema])
def list_posts(
    request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    author: Optional[str] = None
):
    """List published posts with filtering and pagination"""
    queryset = Post.objects.filter(status=Post.StatusChoices.PUBLISHED).select_related(
        'author', 'category'
    ).prefetch_related('tags')
    
    # Apply filters
    if category:
        queryset = queryset.filter(category__slug=category)
    
    if tag:
        queryset = queryset.filter(tags__slug=tag)
    
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search) | 
            Q(content__icontains=search) |
            Q(excerpt__icontains=search)
        )
    
    if featured is not None:
        queryset = queryset.filter(is_featured=featured)
    
    if author:
        queryset = queryset.filter(author__username=author)
    
    # Pagination
    offset = (page - 1) * limit
    posts = queryset[offset:offset + limit]
    
    return posts

@blog_router.get("/posts/{slug}", response=PostDetailSchema)
def get_post(request, slug: str):
    """Get single post by slug"""
    post = get_object_or_404(
        Post.objects.select_related('author', 'category').prefetch_related('tags'),
        slug=slug,
        status=Post.StatusChoices.PUBLISHED
    )
    return post

@blog_router.post("/posts", response={201: PostDetailSchema, 400: ErrorSchema}, auth=jwt_auth)
def create_post(request, data: PostCreateSchema):
    """Create a new post (committee members only)"""
    user = request.auth
    
    if not (user.is_superuser or user.is_staff):
        return 400, {"error": "Only committee members can create posts"}
    
    try:
        post = Post.objects.create(
            title=data.title,
            content=data.content,
            excerpt=data.excerpt,
            author=user,
            category_id=data.category_id,
            status=data.status,
            is_featured=data.is_featured
        )
        
        if data.tag_ids:
            post.tags.set(data.tag_ids)
        
        return 201, post
        
    except Exception as e:
        return 400, {"error": "Failed to create post", "details": str(e)}

@blog_router.put("/posts/{slug}", response={200: PostDetailSchema, 400: ErrorSchema}, auth=jwt_auth)
def update_post(request, slug: str, data: PostCreateSchema):
    """Update a post (author or committee only)"""
    user = request.auth
    post = get_object_or_404(Post, slug=slug)
    
    if not (post.author == user or user.is_superuser or user.is_staff):
        return 400, {"error": "You can only edit your own posts"}
    
    try:
        for field, value in data.dict(exclude_unset=True).items():
            if field == 'tag_ids':
                if value:
                    post.tags.set(value)
            elif field == 'category_id':
                post.category_id = value
            else:
                setattr(post, field, value)
        
        post.save()
        return 200, post
        
    except Exception as e:
        return 400, {"error": "Failed to update post", "details": str(e)}

@blog_router.delete("/posts/{slug}", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def delete_post(request, slug: str):
    """Delete a post (soft delete)"""
    user = request.auth
    post = get_object_or_404(Post, slug=slug)
    
    if not (post.author == user or user.is_superuser or user.is_staff):
        return 400, {"error": "You can only delete your own posts"}
    
    post.delete()  # This will soft delete
    return 200, {"message": "Post deleted successfully"}

@blog_router.get("/deleted/posts", response=List[PostListSchema], auth=jwt_auth)
def list_deleted_posts(request):
    """List all soft-deleted posts (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    return Post.deleted_objects.all().select_related('author', 'category').prefetch_related('tags')

@blog_router.post("deleted/posts/{post_id}/restore", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def restore_post(request, post_id: int):
    """Restore a soft-deleted post (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    try:
        post = Post.deleted_objects.get(id=post_id)
        post.restore()
        return 200, {"message": f"Post '{post.title}' restored successfully."}
    except Post.DoesNotExist:
        return 400, {"error": "Post not found or not soft-deleted."}



# Comment endpoints
@blog_router.get("/posts/{slug}/comments", response=List[CommentSchema])
def list_comments(request, slug: str):
    """List approved comments for a post"""
    post = get_object_or_404(Post, slug=slug, status=Post.StatusChoices.PUBLISHED)
    
    comments = Comment.objects.filter(
        post=post,
        is_approved=True,
        parent=None
    ).select_related('author').prefetch_related(
        Prefetch(
            'replies',
            queryset=Comment.objects.filter(is_approved=True).select_related('author')
        )
    )
    
    return comments

@blog_router.post("/posts/{slug}/comments", response={201: CommentSchema, 400: ErrorSchema}, auth=jwt_auth)
def create_comment(request, slug: str, data: CommentCreateSchema):
    """Create a comment on a post"""
    post = get_object_or_404(Post, slug=slug, status=Post.StatusChoices.PUBLISHED)
    user = request.auth
    
    try:
        comment = Comment.objects.create(
            post=post,
            author=user,
            content=data.content,
            parent_id=data.parent_id
        )
        
        return 201, comment
        
    except Exception as e:
        return 400, {"error": "Failed to create comment", "details": str(e)}

@blog_router.get("/deleted/comments", response=List[CommentSchema], auth=jwt_auth)
def list_deleted_comments(request):
    """List all soft-deleted comments (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    return Comment.deleted_objects.all().select_related('author', 'post')

@blog_router.post("/deleted/comments/{comment_id}/restore", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def restore_comment(request, comment_id: int):
    """Restore a soft-deleted comment (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    try:
        comment = Comment.deleted_objects.get(id=comment_id)
        comment.restore()
        return 200, {"message": f"Comment by {comment.author.username} restored successfully."}
    except Comment.DoesNotExist:
        return 400, {"error": "Comment not found or not soft-deleted."}



# Like endpoints
@blog_router.post("/posts/{slug}/like", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def toggle_like(request, slug: str):
    """Toggle like on a post"""
    post = get_object_or_404(Post, slug=slug, status=Post.StatusChoices.PUBLISHED)
    user = request.auth
    
    like, created = Like.objects.get_or_create(post=post, user=user)
    
    if not created:
        like.delete()
        return 200, {"message": "Post unliked"}
    
    return 200, {"message": "Post liked"}

@blog_router.get("/posts/{slug}/likes", response={200: MessageSchema})
def get_likes_count(request, slug: str):
    """Get likes count for a post"""
    post = get_object_or_404(Post, slug=slug, status=Post.StatusChoices.PUBLISHED)
    count = post.likes.count()
    return {"message": f"{count}"}



# Category endpoints
@blog_router.get("/categories", response=List[CategorySchema])
def list_categories(request):
    """List all categories"""
    return Category.objects.all()

@blog_router.get("/categories/{slug}", response=CategorySchema)
def get_category(request, slug: str):
    """Get single category by slug"""
    return get_object_or_404(Category, slug=slug)

@blog_router.get("/deleted/categories", response=List[CategorySchema], auth=jwt_auth)
def list_deleted_categories(request):
    """List all soft-deleted categories (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    return Category.deleted_objects.all()

@blog_router.post("/deleted/categories/{category_id}/restore", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def restore_category(request, category_id: int):
    """Restore a soft-deleted category (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    try:
        category = Category.deleted_objects.get(id=category_id)
        category.restore()
        return 200, {"message": f"Category '{category.name}' restored successfully."}
    except Category.DoesNotExist:
        return 400, {"error": "Category not found or not soft-deleted."}



# Tag endpoints
@blog_router.get("/tags", response=List[TagSchema])
def list_tags(request):
    """List all tags"""
    return Tag.objects.all()

@blog_router.get("/tags/{slug}", response=TagSchema)
def get_tag(request, slug: str):
    """Get single tag by slug"""
    return get_object_or_404(Tag, slug=slug)

@blog_router.get("/deleted/tags", response=List[TagSchema], auth=jwt_auth)
def list_deleted_tags(request):
    """List all soft-deleted tags (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    return Tag.all_objects.all()

@blog_router.post("/deleted/tags/{tag_id}/restore", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def restore_tag(request, tag_id: int):
    """Restore a soft-deleted tag (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    try:
        tag = Tag.deleted_objects.get(id=tag_id)
        tag.restore()
        return 200, {"message": f"Tag '{tag.name}' restored successfully."}
    except Tag.DoesNotExist:
        return 400, {"error": "Tag not found or not soft-deleted."}
