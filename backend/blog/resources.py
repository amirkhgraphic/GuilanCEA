from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget, ManyToManyWidget

from users.models import User
from blog.models import Post, Category, Tag

class CategoryResource(resources.ModelResource):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'created_at')

class PostResource(resources.ModelResource):
    author = fields.Field(
        column_name='author',
        attribute='author',
        widget=ForeignKeyWidget(User, 'username')
    )
    category = fields.Field(
        column_name='category',
        attribute='category',
        widget=ForeignKeyWidget(Category, 'name')
    )
    tags = fields.Field(
        column_name='tags',
        attribute='tags',
        widget=ManyToManyWidget(Tag, field='name', separator='|')
    )

    class Meta:
        model = Post
        fields = ('id', 'title', 'slug', 'content', 'excerpt', 'author', 
                 'category', 'tags', 'status', 'is_featured', 'published_at', 'created_at')
