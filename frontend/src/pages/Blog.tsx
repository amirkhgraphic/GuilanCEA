import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  author: {
    username: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  category?: {
    name: string;
  };
}

export default function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    try {
      const data = await api.getPosts({ search: search || undefined });
      setPosts(data as Post[]);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">وبلاگ</h1>

        <div className="mb-8">
          <Input
            type="text"
            placeholder="جستجو در مقالات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">در حال بارگذاری...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground">مقاله‌ای یافت نشد</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                    <CardDescription>
                      {post.category?.name && (
                        <span className="text-primary ml-2">{post.category.name}</span>
                      )}
                      {new Date(post.created_at).toLocaleDateString('fa-IR')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {post.excerpt && (
                      <p className="text-muted-foreground line-clamp-3 mb-4">
                        {post.excerpt}
                      </p>
                    )}
                    <p className="text-sm">
                      نویسنده: {post.author.first_name} {post.author.last_name}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
