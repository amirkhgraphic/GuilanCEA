import * as React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type {
  EventAdminDetailSchema,
  EventListItemSchema,
  PaginatedResponse,
  RegistrationAdminSchema,
  UserListSchema,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  formatJalali,
  formatNumberPersian,
  formatToman,
  getThumbUrl,
  resolveErrorMessage,
  toPersianDigits,
} from '@/lib/utils';
import Markdown from '@/components/Markdown';

const USERS_PAGE_SIZE = 25;
const EVENTS_PAGE_SIZE = 50;
const REGISTRATIONS_PAGE_SIZE = 8;

const eventStatusOptions = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'published', label: 'منتشر شده' },
  { value: 'cancelled', label: 'لغو شده' },
  { value: 'completed', label: 'به پایان رسیده' },
];

const statusConfig: Record<
  EventListItemSchema['status'],
  { label: string; variant: 'outline' | 'default' | 'destructive' | 'secondary' }
> = {
  draft: { label: 'پیش‌نویس', variant: 'outline' },
  published: { label: 'منتشر شده', variant: 'default' },
  cancelled: { label: 'لغو شده', variant: 'destructive' },
  completed: { label: 'به پایان رسیده', variant: 'secondary' },
};

const registrationStatusOptions = ['confirmed', 'pending', 'cancelled'] as const;

const eventSortOptions = [
  { value: 'newest', label: 'جدیدترین شروع' },
  { value: 'oldest', label: 'قدیمی‌ترین شروع' },
  { value: 'priceAsc', label: 'ارزان‌ترین' },
  { value: 'priceDesc', label: 'گران‌ترین' },
];

const formatDatePersian = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('fa-IR');
};

function AdminUsersPanel() {
  const { toast } = useToast();
  const [filters, setFilters] = React.useState({
    search: '',
    studentId: '',
    university: 'all',
    major: 'all',
    isActive: 'all',
  });
  const [page, setPage] = React.useState(1);

  const majorsQuery = useQuery({
    queryKey: ['majors'],
    queryFn: () => api.getMajors(),
  });
  const universitiesQuery = useQuery({
    queryKey: ['universities'],
    queryFn: () => api.getUniversities(),
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', filters, page],
    queryFn: () =>
      api.listUsers({
        search: filters.search || undefined,
        student_id: filters.studentId || undefined,
        university: filters.university === 'all' ? undefined : filters.university,
        major: filters.major === 'all' ? undefined : filters.major,
        is_active:
          filters.isActive === 'all'
            ? undefined
            : filters.isActive === 'active'
            ? 'true'
            : 'false',
        limit: USERS_PAGE_SIZE,
        offset: (page - 1) * USERS_PAGE_SIZE,
      }),
  });

  const users = usersQuery.data ?? [];
  const hasMore = users.length === USERS_PAGE_SIZE;

  React.useEffect(() => {
    if (usersQuery.error) {
      toast({
        title: 'خطا در بارگذاری کاربران',
        description: resolveErrorMessage(usersQuery.error),
        variant: 'destructive',
      });
    }
  }, [usersQuery.error, toast]);

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>کاربران</CardTitle>
        <CardDescription>فیلتر، جستجو و مرور کاربران</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            placeholder="جستجو بر اساس نام / کاربری / ایمیل"
            value={filters.search}
            onChange={(event) => handleFilterChange('search', event.target.value)}
          />
          <Input
            placeholder="کد دانشجویی"
            value={filters.studentId}
            onChange={(event) => handleFilterChange('studentId', event.target.value)}
          />
          <Select value={filters.isActive} onValueChange={(value) => handleFilterChange('isActive', value)}>
            <SelectTrigger>
              <SelectValue>
                {{
                  all: 'همه وضعیت‌ها',
                  active: 'فعال',
                  inactive: 'غیرفعال',
                }[filters.isActive]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="inactive">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
              <Select
                value={filters.university}
                onValueChange={(value) => handleFilterChange('university', value)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {filters.university === 'all'
                      ? 'دانشگاه'
                      : universitiesQuery.data?.find((item) => item.code === filters.university)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  {universitiesQuery.data?.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.major} onValueChange={(value) => handleFilterChange('major', value)}>
                <SelectTrigger>
                  <SelectValue>
                    {filters.major === 'all'
                      ? 'گرایش'
                      : majorsQuery.data?.find((item) => item.code === filters.major)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  {majorsQuery.data?.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
        </div>

        {usersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">هیچ کاربری مطابق فیلترها یافت نشد.</p>
        ) : (
          <ScrollArea className="rounded-md border">
            <table dir="rtl" className="w-full min-w-[700px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right">نام کامل</th>
                  <th className="px-3 py-2 text-right">نام کاربری</th>
                  <th className="px-3 py-2 text-right">ایمیل</th>
                  <th className="px-3 py-2 text-right">دانشگاه / گرایش</th>
                  <th className="px-3 py-2 text-right">وضعیت</th>
                  <th className="px-3 py-2 text-right">تاریخ عضویت</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-3 py-2 text-right">
                      {user.full_name ||
                        `${user.first_name} ${user.last_name}`.trim() ||
                        user.username}
                    </td>
                    <td className="px-3 py-2 text-right">{user.username}</td>
                    <td className="px-3 py-2 text-right">{user.email}</td>
                    <td className="px-3 py-2 text-right">
                      {user.major || '—'} • {user.university || '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={user.is_active ? 'default' : 'outline'}>
                        {user.is_active ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatJalali(user.date_joined)}
                    </td>
                </tr>
              ))}
            </tbody>
            </table>
          </ScrollArea>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>صفحه {formatNumberPersian(page)}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
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

function EventDetailDialog({
  eventId,
  open,
  onOpenChange,
  onRefresh,
}: {
  eventId: number | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = React.useState({
    title: '',
    status: 'draft',
    price: '',
  });
  const [regFilters, setRegFilters] = React.useState({
    statuses: registrationStatusOptions,
    university: '',
    major: '',
    search: '',
  });
  const [regPage, setRegPage] = React.useState(1);

  const detailQuery = useQuery({
    queryKey: ['admin', 'event-detail', eventId],
    queryFn: () => api.getEventAdminDetail(eventId!),
    enabled: Boolean(eventId) && open,
  });

  React.useEffect(() => {
    if (detailQuery.data) {
      setEditValues({
        title: detailQuery.data.title,
        status: detailQuery.data.status,
        price: Math.floor(detailQuery.data.price / 10).toString(),
      });
    }
  }, [detailQuery.data]);

  const registrationsQuery = useQuery({
    queryKey: ['admin', 'event', eventId, 'registrations', regFilters, regPage],
    enabled: Boolean(eventId) && Boolean(regFilters.statuses.length),
    queryFn: () =>
      api.listEventRegistrationsAdmin(eventId!, {
        statuses: regFilters.statuses,
        university: regFilters.university || undefined,
        major: regFilters.major || undefined,
        search: regFilters.search || undefined,
        limit: REGISTRATIONS_PAGE_SIZE,
        offset: (regPage - 1) * REGISTRATIONS_PAGE_SIZE,
      }),
  });

  React.useEffect(() => {
    if (detailQuery.error) {
      toast({
        title: 'خطا',
        description: resolveErrorMessage(detailQuery.error),
        variant: 'destructive',
      });
    }
  }, [detailQuery.error, toast]);

  const editMutation = useMutation({
    mutationFn: (data: { title: string; status: string; price: number }) =>
      api.updateEvent(eventId!, data),
    onSuccess: () => {
      toast({ title: 'رویداد به‌روزرسانی شد', variant: 'success' });
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ['admin', 'event-detail', eventId] });
    },
    onError: (error) => {
      toast({
        title: 'خطا',
        description: resolveErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleEditSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const priceValue = Number(editValues.price);
    if (Number.isNaN(priceValue)) {
      toast({ title: 'قیمت نامعتبر است', variant: 'destructive' });
      return;
    }
    editMutation.mutate({
      title: editValues.title,
      status: editValues.status,
      price: priceValue * 10,
    });
  };

  const registrationPageCount = React.useMemo(() => {
    if (!registrationsQuery.data) return 1;
    return Math.max(1, Math.ceil(registrationsQuery.data.count / REGISTRATIONS_PAGE_SIZE));
  }, [registrationsQuery.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>جزئیات رویداد</DialogTitle>
          <DialogDescription>
            اطلاعات رویداد، ویرایش سریع و لیست ثبت‌نام‌ها را می‌توانید در این پنجره بررسی کنید.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{detailQuery.data?.title || 'در حال بارگذاری...'}</CardTitle>
                <CardDescription>
                  وضعیت:{' '}
                  <Badge variant={statusConfig[detailQuery.data?.status ?? 'draft'].variant}>
                    {statusConfig[detailQuery.data?.status ?? 'draft'].label}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  تاریخ شروع: {formatDatePersian(detailQuery.data?.start_time)}
                </div>
                <div className="text-sm text-muted-foreground">
                  ظرفیت: {detailQuery.data?.capacity ?? 'نامحدود'}
                </div>
                <div className="text-sm text-muted-foreground">
                  تعداد ثبت‌نام: {registrationsQuery.data?.count ?? '—'}
                </div>
                <Markdown content={detailQuery.data?.description} size="base" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>ویرایش خلاصه</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleEditSubmit}>
                  <Input
                    placeholder="عنوان جدید"
                    value={editValues.title}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, title: event.target.value }))}
                  />
                  <Select value={editValues.status} onValueChange={(value) => setEditValues((prev) => ({ ...prev, status: value }))}>
                    {eventStatusOptions
                      .filter((option) => option.value !== 'all')
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </Select>
                  <Input
                    placeholder="قیمت (تومان)"
                    value={editValues.price}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, price: event.target.value }))}
                  />
                  <Button type="submit" disabled={editMutation.isLoading}>
                    ذخیره
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ثبت‌نام‌ها</CardTitle>
                <CardDescription>
                  فیلترها: وضعیت، دانشگاه، گرایش، نام/نام‌کاربری/ایمیل
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {registrationStatusOptions.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={regFilters.statuses.includes(status) ? 'default' : 'outline'}
                        onClick={() => {
                          setRegFilters((prev) => {
                            const exists = prev.statuses.includes(status);
                            let next = exists
                              ? prev.statuses.filter((item) => item !== status)
                              : [...prev.statuses, status];
                            if (next.length === 0) {
                              next = registrationStatusOptions;
                            }
                            return { ...prev, statuses: next };
                          });
                          setRegPage(1);
                        }}
                      >
                        {status}
                      </Button>
                  ))}
                </div>
                <Input
                  placeholder="جستجو نام / ایمیل / نام کاربری"
                  value={regFilters.search}
                  onChange={(event) => {
                    setRegFilters((prev) => ({ ...prev, search: event.target.value }));
                    setRegPage(1);
                  }}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    placeholder="دانشگاه"
                    value={regFilters.university}
                    onChange={(event) => {
                      setRegFilters((prev) => ({ ...prev, university: event.target.value }));
                      setRegPage(1);
                    }}
                  />
                  <Input
                    placeholder="گرایش"
                    value={regFilters.major}
                    onChange={(event) => {
                      setRegFilters((prev) => ({ ...prev, major: event.target.value }));
                      setRegPage(1);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  {registrationsQuery.data?.results.map((registration) => (
                    <Card key={registration.id} className="bg-muted/20">
                      <CardHeader className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{registration.user.first_name} {registration.user.last_name}</span>
                          <Badge
                            variant={registration.status === 'confirmed' ? 'default' : 'outline'}
                          >
                            {registration.status_label}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">{registration.user.email}</div>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-1">
                        <div>
                          نام‌کاربری: {registration.user.username} • کد بلیت: {registration.ticket_id}
                        </div>
                        <div>تاریخ ثبت‌نام: {formatDatePersian(registration.registered_at)}</div>
                        <div>قیمت نهایی: {formatToman(registration.final_price ?? 0)}</div>
                        <div>تخفیف: {formatToman(registration.discount_amount ?? 0)}</div>
                        {registration.payments.length > 0 && (
                          <div className="space-y-1">
                            پرداخت:
                            {registration.payments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between gap-2">
                                <span>{payment.status_label}</span>
                                <span>{formatToman(payment.amount)}</span>
                                <span>Ref: {payment.ref_id ?? '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    صفحه {formatNumberPersian(regPage)} از{' '}
                    {formatNumberPersian(registrationPageCount)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={regPage <= 1}
                      onClick={() => setRegPage((prev) => Math.max(1, prev - 1))}
                    >
                      قبلی
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={regPage >= registrationPageCount}
                      onClick={() => setRegPage((prev) => prev + 1)}
                    >
                      بعدی
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminEventsPanel({ onOpenDetail }: { onOpenDetail: (event: EventListItemSchema) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = React.useState({
    search: '',
    status: 'all',
    type: 'all',
    sort: 'newest',
  });

  const eventsQuery = useQuery({
    queryKey: ['admin', 'events', filters],
    queryFn: () =>
      api.getEvents({
        statuses: filters.status === 'all' ? undefined : [filters.status],
        event_type: filters.type === 'all' ? undefined : filters.type,
        search: filters.search || undefined,
        limit: EVENTS_PAGE_SIZE,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: number) => api.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      toast({ title: 'رویداد حذف شد', variant: 'success' });
    },
    onError: (error) => {
      toast({
        title: 'خطا',
        description: resolveErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const sortedEvents = React.useMemo(() => {
    const list = (eventsQuery.data ?? []).slice();
    switch (filters.sort) {
      case 'newest':
        return list.sort((a, b) => (new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
      case 'oldest':
        return list.sort((a, b) => (new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      case 'priceAsc':
        return list.sort((a, b) => Number(a.price) - Number(b.price));
      case 'priceDesc':
        return list.sort((a, b) => Number(b.price) - Number(a.price));
      default:
        return list;
    }
  }, [eventsQuery.data, filters.sort]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>رویدادها</CardTitle>
        <CardDescription>جستجو، فیلتر و مدیریت رویدادها</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            placeholder="جستجوی رویداد..."
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
          <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
            {eventStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
          <Select value={filters.type} onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}>
            <SelectItem value="all">تمام نوع‌ها</SelectItem>
            <SelectItem value="online">آنلاین</SelectItem>
            <SelectItem value="on_site">حضوری</SelectItem>
            <SelectItem value="hybrid">ترکیبی</SelectItem>
          </Select>
          <Select value={filters.sort} onValueChange={(value) => setFilters((prev) => ({ ...prev, sort: value }))}>
            {eventSortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        {eventsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال بارگذاری رویدادها...</p>
        ) : sortedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">رویدادی مطابق فیلترها نیست.</p>
        ) : (
          <ScrollArea className="rounded-md border">
            <table dir="rtl" className="w-full min-w-[780px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right">پوستر</th>
                  <th className="px-3 py-2 text-right">عنوان</th>
                  <th className="px-3 py-2 text-right">وضعیت</th>
                  <th className="px-3 py-2 text-right">تاریخ شروع</th>
                  <th className="px-3 py-2 text-right">ثبت‌نام‌ها</th>
                  <th className="px-3 py-2 text-right">قیمت (تومان)</th>
                  <th className="px-3 py-2 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((event) => (
                  <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-3 py-2 text-right">
                      <img
                        src={getThumbUrl(event)}
                        alt={event.title}
                        className="h-12 w-12 rounded object-cover"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-3 py-2 text-right cursor-pointer" onClick={() => onOpenDetail(event)}>
                      {event.title}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={statusConfig[event.status].variant}>
                        {statusConfig[event.status].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{formatDatePersian(event.start_time)}</td>
                    <td className="px-3 py-2 text-right">{toPersianDigits(event.registration_count)}</td>
                    <td className="px-3 py-2 text-right">{formatToman(event.price)}</td>
                    <td className="px-3 py-2 text-left space-x-2">
                      <Button size="sm" variant="outline" onClick={() => onOpenDetail(event)}>
                        جزئیات
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(event.id)}
                      >
                        حذف
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [detailEvent, setDetailEvent] = React.useState<EventListItemSchema | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleOpenDetail = (event: EventListItemSchema) => {
    setDetailEvent(event);
    setDialogOpen(true);
  };

  const handleCloseDetail = () => {
    setDialogOpen(false);
    setTimeout(() => setDetailEvent(null), 200);
  };

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
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">پنل مدیریت</h1>
        <Tabs defaultValue="users">
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <TabsList orientation="vertical" className="shadow-lg">
              <TabsTrigger value="users">کاربران</TabsTrigger>
              <TabsTrigger value="events">رویدادها</TabsTrigger>
            </TabsList>
            <div className="space-y-6">
              <TabsContent value="users">
                <AdminUsersPanel />
              </TabsContent>
              <TabsContent value="events">
                <AdminEventsPanel onOpenDetail={handleOpenDetail} />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

      <EventDetailDialog
        eventId={detailEvent?.id ?? null}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDetail();
          else setDialogOpen(true);
        }}
        onRefresh={() => {}}
      />
    </div>
  );
}
