import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type {
  CommentSchema,
  EventListItemSchema,
  PostListSchema,
  UserProfileSchema,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { resolveErrorMessage } from '@/lib/utils';

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('fa-IR');
};

const eventStatusConfig: Record<
  EventListItemSchema['status'],
  { label: string; variant: 'outline' | 'default' | 'destructive' | 'secondary' }
> = {
  draft: { label: 'پیش‌نویس', variant: 'outline' },
  published: { label: 'منتشر شده', variant: 'default' },
  cancelled: { label: 'لغو شده', variant: 'destructive' },
  completed: { label: 'به پایان رسیده', variant: 'secondary' },
};

const getFullName = (user: UserProfileSchema) => {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return name || user.username;
};

const getPriceLabel = (value?: number | null) => {
  if (value == null) {
    return 'رایگان';
  }
  return `${value.toLocaleString('fa-IR')} تومان`;
};

function AdminUsersPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deletedUsersQuery = useQuery({
    queryKey: ['admin', 'deleted-users'],
    queryFn: () => api.listDeletedUsers(),
  });

  const restoreUserMutation = useMutation({
    mutationFn: (userId: number) => api.restoreUser(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deleted-users'] });
      toast({
        title: 'کاربر بازیابی شد',
        description: `کاربر با شناسه ${userId} به لیست فعال بازگشت.`,
      });
    },
    onError: error => {
      toast({
        variant: 'destructive',
        title: 'خطا در بازیابی',
        description: resolveErrorMessage(error),
      });
    },
  });

  const handleRestoreUser = (user: UserProfileSchema) => {
    if (!confirm(`آیا مایل به بازگردانی کاربر ${user.username} هستید؟`)) {
      return;
    }
    restoreUserMutation.mutate(user.id);
  };

  const users = deletedUsersQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>کاربران حذف‌شده</CardTitle>
        <CardDescription>
          در این بخش می‌توانید حساب‌های حذف شده را مشاهده و در صورت نیاز بازگردانی کنید.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deletedUsersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری کاربران...</p>
        ) : deletedUsersQuery.error ? (
          <p className="text-sm text-destructive">
            {resolveErrorMessage(deletedUsersQuery.error)}
          </p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">هیچ کاربری برای بازگردانی وجود ندارد.</p>
        ) : (
          <ScrollArea className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>شناسه</TableHead>
                  <TableHead>نام کامل</TableHead>
                  <TableHead>ایمیل</TableHead>
                  <TableHead>تاریخ حذف</TableHead>
                  <TableHead>اقدام</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>{getFullName(user)}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{formatDate(user.deleted_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRestoreUser(user)}
                        disabled={restoreUserMutation.isLoading}
                      >
                        بازگردانی
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function AdminPostsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: ['admin', 'posts'],
    queryFn: () => api.getPosts({ limit: 25 }),
  });

  const deletedPostsQuery = useQuery({
    queryKey: ['admin', 'deleted-posts'],
    queryFn: () => api.listDeletedPosts(),
  });

  const deletePostMutation = useMutation({
    mutationFn: (slug: string) => api.deletePost(slug),
    onSuccess: (_, slug) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'deleted-posts'] });
      toast({
        title: 'مقاله حذف شد',
        description: `مقاله با شناسه "${slug}" به سطل زباله منتقل شد.`,
      });
    },
    onError: error => {
      toast({
        variant: 'destructive',
        title: 'خطا در حذف',
        description: resolveErrorMessage(error),
      });
    },
  });

  const restorePostMutation = useMutation({
    mutationFn: (postId: number) => api.restorePost(postId),
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deleted-posts'] });
      toast({
        title: 'مقاله بازیابی شد',
        description: `مقاله شماره ${postId} بار دیگر قابل نمایش است.`,
      });
    },
    onError: error => {
      toast({
        variant: 'destructive',
        title: 'خطا در بازیابی',
        description: resolveErrorMessage(error),
      });
    },
  });

  const activePosts = postsQuery.data ?? [];
  const deletedPosts = deletedPostsQuery.data ?? [];

  const handleDeletePost = (post: PostListSchema) => {
    if (!confirm(`آیا مایل به حذف مقاله "${post.title}" هستید؟`)) {
      return;
    }
    deletePostMutation.mutate(post.slug);
  };

  const handleRestorePost = (post: PostListSchema) => {
    if (!confirm(`آیا مایل به بازگردانی مقاله "${post.title}" هستید؟`)) {
      return;
    }
    restorePostMutation.mutate(post.id);
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>مقالات فعال</CardTitle>
          <CardDescription>مقالات منتشر شده یا آماده انتشار را ببینید و در صورت لزوم حذف کنید.</CardDescription>
        </CardHeader>
        <CardContent>
          {postsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری مقالات...</p>
          ) : postsQuery.error ? (
            <p className="text-sm text-destructive">{resolveErrorMessage(postsQuery.error)}</p>
          ) : activePosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز مقاله‌ای منتشر نشده است.</p>
          ) : (
            <ScrollArea className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>عنوان</TableHead>
                    <TableHead>نویسنده</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>تاریخ ایجاد</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePosts.map(post => (
                    <TableRow key={post.id}>
                      <TableCell>{post.title}</TableCell>
                      <TableCell>{post.author.username}</TableCell>
                      <TableCell>{post.status}</TableCell>
                      <TableCell>{formatDate(post.created_at)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeletePost(post)}
                          disabled={deletePostMutation.isLoading}
                        >
                          حذف
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مقالات حذف‌شده</CardTitle>
          <CardDescription>مقالات حذف شده را بازگردانید یا اطلاعات آن‌ها را بررسی کنید.</CardDescription>
        </CardHeader>
        <CardContent>
          {deletedPostsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری مقالات حذف شده...</p>
          ) : deletedPostsQuery.error ? (
            <p className="text-sm text-destructive">
              {resolveErrorMessage(deletedPostsQuery.error)}
            </p>
          ) : deletedPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">هیچ مقاله‌ای حذف نشده است.</p>
          ) : (
            <ScrollArea className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>عنوان</TableHead>
                    <TableHead>نویسنده</TableHead>
                    <TableHead>تاریخ حذف</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedPosts.map(post => (
                    <TableRow key={post.id}>
                      <TableCell>{post.title}</TableCell>
                      <TableCell>{post.author.username}</TableCell>
                      <TableCell>{formatDate(post.published_at ?? post.created_at)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRestorePost(post)}
                          disabled={restorePostMutation.isLoading}
                        >
                          بازگردانی
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function AdminEventsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const eventsQuery = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: () =>
      api.getEvents({
        statuses: ['draft', 'published', 'cancelled', 'completed'],
        limit: 25,
      }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: number) => api.deleteEvent(eventId),
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      toast({
        title: 'رویداد حذف شد',
        description: `رویداد با شناسه ${eventId} حذف شد.`,
      });
    },
    onError: error => {
      toast({
        variant: 'destructive',
        title: 'خطا در حذف رویداد',
        description: resolveErrorMessage(error),
      });
    },
  });

  const handleDeleteEvent = (event: EventListItemSchema) => {
    if (!confirm(`آیا رویداد "${event.title}" حذف شود؟`)) {
      return;
    }
    deleteEventMutation.mutate(event.id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>رویدادها</CardTitle>
        <CardDescription>رویدادهای سایت را بررسی کرده و در صورت نیاز حذف یا تغییر وضعیت دهید.</CardDescription>
      </CardHeader>
      <CardContent>
        {eventsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری رویدادها...</p>
        ) : eventsQuery.error ? (
          <p className="text-sm text-destructive">{resolveErrorMessage(eventsQuery.error)}</p>
        ) : eventsQuery.data?.length ? (
          <ScrollArea className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>عنوان</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ آغاز</TableHead>
                  <TableHead>قیمت</TableHead>
                  <TableHead>تعداد ثبت‌نام</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventsQuery.data.map(event => (
                  <TableRow key={event.id}>
                    <TableCell>{event.title}</TableCell>
                    <TableCell>
                      <Badge variant={eventStatusConfig[event.status].variant}>
                        {eventStatusConfig[event.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(event.start_time)}</TableCell>
                    <TableCell>{getPriceLabel(event.price)}</TableCell>
                    <TableCell>{event.registration_count}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteEvent(event)}
                        disabled={deleteEventMutation.isLoading}
                      >
                        حذف
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground">در حال حاضر رویدادی ثبت نشده است.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AdminCommentsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deletedCommentsQuery = useQuery({
    queryKey: ['admin', 'deleted-comments'],
    queryFn: () => api.listDeletedComments(),
  });

  const restoreCommentMutation = useMutation({
    mutationFn: (commentId: number) => api.restoreComment(commentId),
    onSuccess: (_, commentId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deleted-comments'] });
      toast({
        title: 'نظر بازیابی شد',
        description: `نظر شماره ${commentId} ثبت شده توسط کاربر بازگشت.`,
      });
    },
    onError: error => {
      toast({
        variant: 'destructive',
        title: 'خطا در بازیابی نظر',
        description: resolveErrorMessage(error),
      });
    },
  });

  const handleRestoreComment = (comment: CommentSchema) => {
    if (!confirm(`آیا نظر مربوط به "${comment.post_title}" بازگردانده شود؟`)) {
      return;
    }
    restoreCommentMutation.mutate(comment.id);
  };

  const comments = deletedCommentsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>نظرات حذف‌شده</CardTitle>
        <CardDescription>نظرات حذف‌شده بلاگ را بررسی و در صورت نیاز بازیابی کنید.</CardDescription>
      </CardHeader>
      <CardContent>
        {deletedCommentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری نظرات...</p>
        ) : deletedCommentsQuery.error ? (
          <p className="text-sm text-destructive">{resolveErrorMessage(deletedCommentsQuery.error)}</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">هیچ نظر حذف‌شده‌ای وجود ندارد.</p>
        ) : (
          <ScrollArea className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نویسنده</TableHead>
                  <TableHead>محتوا</TableHead>
                  <TableHead>پست</TableHead>
                  <TableHead>تاریخ</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comments.map(comment => (
                  <TableRow key={comment.id}>
                    <TableCell>{comment.author.username}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {comment.content}
                    </TableCell>
                    <TableCell>{comment.post_title}</TableCell>
                    <TableCell>{formatDate(comment.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRestoreComment(comment)}
                        disabled={restoreCommentMutation.isLoading}
                      >
                        بازگردانی
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">در حال بارگذاری...</p>
      </div>
    );
  }

  if (!isAuthenticated || !(user?.is_staff || user?.is_superuser)) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8" dir="rtl">
        <h1 className="text-4xl font-bold mb-8">پنل مدیریت</h1>

        <Tabs defaultValue="users" dir="rtl">
          <TabsList>
            <TabsTrigger value="users">کاربران</TabsTrigger>
            <TabsTrigger value="posts">مقالات</TabsTrigger>
            <TabsTrigger value="events">رویدادها</TabsTrigger>
            <TabsTrigger value="comments">نظرات</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <AdminUsersPanel />
          </TabsContent>

          <TabsContent value="posts" className="mt-6 space-y-6">
            <AdminPostsPanel />
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <AdminEventsPanel />
          </TabsContent>

          <TabsContent value="comments" className="mt-6">
            <AdminCommentsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
