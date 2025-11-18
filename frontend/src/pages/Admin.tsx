import * as React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { EventListItemSchema, EventAdminDetailSchema, UserListSchema } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getThumbUrl, resolveErrorMessage } from '@/lib/utils';
import Markdown from '@/components/Markdown';

const USERS_PAGE_SIZE = 30;

const eventStatusConfig: Record<
  EventListItemSchema['status'],
  { label: string; variant: 'outline' | 'default' | 'destructive' | 'secondary' }
> = {
  draft: { label: 'پیش‌نویس', variant: 'outline' },
  published: { label: 'منتشر شده', variant: 'default' },
  cancelled: { label: 'لغو شده', variant: 'destructive' },
  completed: { label: 'به پایان رسیده', variant: 'secondary' },
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fa-IR');
};

const getPriceLabel = (value?: number | null) => {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  const amount = Number(value);
  return `${amount.toLocaleString('fa-IR')} تومان`;
};

function AdminUsersPanel() {
  const { toast } = useToast();
  const [search, setSearch] = React.useState('');
  const [role, setRole] = React.useState<'all' | 'staff' | 'superuser'>('all');
  const [page, setPage] = React.useState(1);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', search, role, page],
    queryFn: () =>
      api.listUsers({
        search: search.trim() || undefined,
        role: role === 'all' ? undefined : role,
        limit: USERS_PAGE_SIZE,
        offset: (page - 1) * USERS_PAGE_SIZE,
      }),
  });

  const users = usersQuery.data ?? [];
  const isFirstPage = page <= 1;
  const hasMore = users.length === USERS_PAGE_SIZE;

  React.useEffect(() => {
    if (usersQuery.error) {
      toast({
        variant: 'destructive',
        title: 'خطا در بارگذاری کاربران',
        description: resolveErrorMessage(usersQuery.error),
      });
    }
  }, [usersQuery.error, toast]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>کاربران</CardTitle>
        <CardDescription>نمایش و فیلتر کاربران عضو سایت</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="جستجو بر اساس نام، نام کاربری یا ایمیل"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <Select value={role} onValueChange={(value) => { setRole(value as typeof role); setPage(1); }}>
            <SelectTrigger>
              <SelectValue>
                {role === 'all' && 'همه کاربران'}
                {role === 'staff' && 'کارمندان'}
                {role === 'superuser' && 'سوپر یوزرها'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه کاربران</SelectItem>
              <SelectItem value="staff">کارمندان</SelectItem>
              <SelectItem value="superuser">سوپر یوزر</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {usersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری کاربران...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">هیچ کاربری مطابق نتایج جستجو یافت نشد.</p>
        ) : (
          <ScrollArea className="rounded-md border">
            <table dir="rtl" className="w-full min-w-[560px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right">نام و نام خانوادگی</th>
                  <th className="px-3 py-2 text-right">نام کاربری</th>
                  <th className="px-3 py-2 text-right">ایمیل</th>
                  <th className="px-3 py-2 text-right">نقش</th>
                  <th className="px-3 py-2 text-right">وضعیت</th>
                  <th className="px-3 py-2 text-right">تاریخ عضویت</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-3 py-2 text-right">
                      {user.full_name || `${user.first_name} ${user.last_name}`.trim() || '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{user.username}</td>
                    <td className="px-3 py-2 text-right">{user.email}</td>
                    <td className="px-3 py-2 text-right">
                      {user.is_superuser ? (
                        <Badge variant="destructive">سوپر یوزر</Badge>
                      ) : user.is_staff ? (
                        <Badge variant="secondary">استاف</Badge>
                      ) : (
                        <Badge variant="outline">کاربر عادی</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={user.is_active ? 'default' : 'outline'}>
                        {user.is_active ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatDate(user.date_joined)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between text-xs tracking-wide text-muted-foreground">
          <span>صفحه {page}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={isFirstPage} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              قبلی
            </Button>
            <Button size="sm" variant="outline" disabled={!hasMore} onClick={() => setPage((prev) => prev + 1)}>
              بعدی
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminEventsPanel() {
  const { toast } = useToast();
  const eventsQuery = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: () =>
      api.getEvents({
        statuses: ['draft', 'published', 'cancelled', 'completed'],
        limit: 50,
      }),
  });
  const [selectedEventId, setSelectedEventId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!selectedEventId && eventsQuery.data?.length) {
      setSelectedEventId(eventsQuery.data[0].id);
    }
  }, [eventsQuery.data, selectedEventId]);

  const eventDetailQuery = useQuery({
    queryKey: ['admin', 'events', 'detail', selectedEventId],
    queryFn: () => api.getEventAdminDetail(selectedEventId!),
    enabled: Boolean(selectedEventId),
  });

  React.useEffect(() => {
    if (eventDetailQuery.error) {
      toast({
        variant: 'destructive',
        title: 'خطا در بارگذاری جزئیات رویداد',
        description: resolveErrorMessage(eventDetailQuery.error),
      });
    }
  }, [eventDetailQuery.error, toast]);

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle>رویدادها</CardTitle>
        <CardDescription>مدیریت رویدادها و مشاهده جزئیات ثبت‌نام</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="rounded-md border">
          <table dir="rtl" className="w-full min-w-[720px] text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right">پوستر</th>
                <th className="px-3 py-2 text-right">عنوان</th>
                <th className="px-3 py-2 text-right">وضعیت</th>
                <th className="px-3 py-2 text-right">تاریخ شروع</th>
                <th className="px-3 py-2 text-right">تعداد ثبت‌نام</th>
                <th className="px-3 py-2 text-right">قیمت</th>
                <th className="px-3 py-2 text-right">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {eventsQuery.data?.map((event) => {
                const isSelected = selectedEventId === event.id;
                return (
                  <tr
                    key={event.id}
                    className={`border-b last:border-0 hover:bg-muted/60 ${isSelected ? 'bg-muted/50' : ''}`}
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <td className="px-3 py-2 text-right">
                      <img
                        src={getThumbUrl(event)}
                        alt={event.title}
                        className="h-12 w-12 rounded object-cover"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{event.title}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={eventStatusConfig[event.status].variant}>
                        {eventStatusConfig[event.status].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{formatDate(event.start_time)}</td>
                    <td className="px-3 py-2 text-right">{event.registration_count}</td>
                    <td className="px-3 py-2 text-right">{getPriceLabel(event.price)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/admin/events/${event.id}/edit`}>ویرایش</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>

        <div className="space-y-4">
          {selectedEventId ? (
            eventDetailQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">در حال بارگذاری جزئیات...</p>
            ) : eventDetailQuery.data ? (
              <EventDetailPanel event={eventDetailQuery.data} />
            ) : (
              <p className="text-sm text-destructive">جزئیات رویداد پیدا نشد.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">لطفاً یک رویداد انتخاب کنید.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EventDetailPanel({ event }: { event: EventAdminDetailSchema }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{event.title}</CardTitle>
        <CardDescription className="space-y-1">
          <div>وضعیت: <strong>{eventStatusConfig[event.status].label}</strong></div>
          <div>تاریخ شروع: {formatDate(event.start_time)}</div>
          <div>ظرفیت: {event.capacity ?? 'نامحدود'}</div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Markdown content={event.description} justify={true} />
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">ثبت‌نام‌ها ({event.registrations.length})</h3>
          <div className="space-y-3">
            {event.registrations.map((reg) => (
              <Card key={reg.id} className="bg-background">
                <CardHeader className="flex flex-col gap-1 text-right">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">
                      {reg.user.first_name} {reg.user.last_name} ({reg.user.username})
                    </CardTitle>
                    <Badge variant={reg.status === 'confirmed' ? 'default' : 'outline'}>
                      {reg.status_label}
                    </Badge>
                  </div>
                  <CardDescription>
                    ایمیل: {reg.user.email} • ثبت‌نام در {formatDate(reg.registered_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-right text-sm text-muted-foreground">
                  <div>کد بلیت: {reg.ticket_id}</div>
                  <div>قیمت نهایی: {getPriceLabel(reg.final_price ?? 0)}</div>
                  <div>تخفیف: {getPriceLabel(reg.discount_amount ?? 0)}</div>
                  <div>
                    پرداخت‌ها:
                    {reg.payments.length === 0 ? (
                      <span className="mr-2 text-destructive">ثبت نشده</span>
                    ) : (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {reg.payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between gap-2">
                            <span>{payment.status_label}</span>
                            <span>{getPriceLabel(payment.amount)}</span>
                            <span>Ref: {payment.ref_id ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <TabsList orientation="vertical" className="shadow">
              <TabsTrigger value="users">کاربران</TabsTrigger>
              <TabsTrigger value="events">رویدادها</TabsTrigger>
            </TabsList>
            <div className="space-y-6">
              <TabsContent value="users">
                <AdminUsersPanel />
              </TabsContent>
              <TabsContent value="events">
                <AdminEventsPanel />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
