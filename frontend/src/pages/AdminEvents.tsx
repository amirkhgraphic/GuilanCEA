import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { EventAdminDetailSchema, EventListItemSchema, RegistrationAdminSchema } from '@/lib/types';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { formatJalali, formatNumberPersian, formatToman, getThumbUrl, resolveErrorMessage, toPersianDigits } from '@/lib/utils';

const REGISTRATIONS_PAGE_SIZE = 8;
const EVENTS_PAGE_SIZE = 30;

const eventStatusOptions = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'published', label: 'منتشر شده' },
  { value: 'cancelled', label: 'لغو شده' },
  { value: 'completed', label: 'برگزار شده' },
];

const statusConfig: Record<
  EventListItemSchema['status'],
  { label: string; variant: 'outline' | 'default' | 'destructive' | 'secondary' }
> = {
  draft: { label: 'پیش‌نویس', variant: 'outline' },
  published: { label: 'منتشر شده', variant: 'default' },
  cancelled: { label: 'لغو شده', variant: 'destructive' },
  completed: { label: 'برگزار شده', variant: 'secondary' },
};

const registrationStatusOptions = ['confirmed', 'pending', 'cancelled'] as const;

const eventSortOptions = [
  { value: 'newest', label: 'جدیدترین شروع' },
  { value: 'oldest', label: 'قدیمی‌ترین شروع' },
  { value: 'priceAsc', label: 'قیمت صعودی' },
  { value: 'priceDesc', label: 'قیمت نزولی' },
];

const formatDatePersian = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('fa-IR');
};

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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>جزئیات رویداد</DialogTitle>
          <DialogDescription>
            مدیریت وضعیت، قیمت و ثبت‌نام‌های این رویداد از این بخش انجام می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr] max-h-[78vh]">
          <div className="space-y-4 overflow-auto">
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
                  شروع: {formatDatePersian(detailQuery.data?.start_time)}
                </div>
                <div className="text-sm text-muted-foreground">
                  ظرفیت: {detailQuery.data?.capacity ?? 'نامحدود'}
                </div>
                <div className="text-sm text-muted-foreground">
                  تعداد ثبت‌نام: {registrationsQuery.data?.count ?? '—'}
                </div>
                <div className="text-sm text-muted-foreground">
                  لینک ویرایش:{" "}
                  {detailQuery.data ? (
                    <Link className="text-primary underline" to={`/admin/events/${detailQuery.data.id}/edit`}>
                      ویرایش پیشرفته
                    </Link>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="border-t pt-3">
                  <CardTitle className="text-sm mb-2">توضیحات</CardTitle>
                  <CardDescription className="text-xs leading-6 text-muted-foreground">
                    {detailQuery.data?.description?.slice(0, 200) || '—'}
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>ویرایش سریع</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleEditSubmit}>
                  <Input
                    placeholder="عنوان رویداد"
                    value={editValues.title}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, title: event.target.value }))}
                  />
                  <Select
                    value={editValues.status}
                    onValueChange={(value) => setEditValues((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {eventStatusOptions.find((option) => option.value === editValues.status)?.label || 'وضعیت'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {eventStatusOptions
                        .filter((option) => option.value !== 'all')
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
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
          <div className="space-y-4 overflow-auto">
            <Card>
              <CardHeader>
                <CardTitle>ثبت‌نام‌ها</CardTitle>
                <CardDescription>
                  فیلتر و مرور ثبت‌نام‌های این رویداد
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[52vh] overflow-auto">
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
                  placeholder="نام، ایمیل یا نام‌کاربری"
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
                    placeholder="رشته"
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
                          نام‌کاربری: {registration.user.username} · کد بلیت: {registration.ticket_id}
                        </div>
                        <div>تاریخ ثبت‌نام: {formatDatePersian(registration.registered_at)}</div>
                        <div>مبلغ پرداختی: {formatToman(registration.final_price ?? 0)}</div>
                        <div>تخفیف: {formatToman(registration.discount_amount ?? 0)}</div>
                        {registration.payments.length > 0 && (
                          <div className="space-y-1">
                            پرداخت‌ها:
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
                    صفحه {formatNumberPersian(regPage)} از {formatNumberPersian(registrationPageCount)}
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

const AdminEventsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = React.useState({
    search: '',
    status: 'all',
    type: 'all',
    sort: 'newest',
  });

  const [detailEvent, setDetailEvent] = React.useState<EventListItemSchema | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

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
        return list.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      case 'oldest':
        return list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      case 'priceAsc':
        return list.sort((a, b) => Number(a.price) - Number(b.price));
      case 'priceDesc':
        return list.sort((a, b) => Number(b.price) - Number(a.price));
      default:
        return list;
    }
  }, [eventsQuery.data, filters.sort]);

  const handleOpenDetail = (event: EventListItemSchema) => {
    setDetailEvent(event);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">رویدادها</h2>
        <p className="text-sm text-muted-foreground">مدیریت رویدادها، ثبت‌نام‌ها و وضعیت انتشار</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>فیلترها</CardTitle>
          <CardDescription>پیدا کردن سریع رویدادها</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="عنوان رویداد..."
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue>
                  {eventStatusOptions.find((option) => option.value === filters.status)?.label ||
                    'وضعیت'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {eventStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.type} onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue>
                  {{
                    all: 'همه انواع',
                    online: 'آنلاین',
                    on_site: 'حضوری',
                    hybrid: 'ترکیبی',
                  }[filters.type]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه انواع</SelectItem>
                <SelectItem value="online">آنلاین</SelectItem>
                <SelectItem value="on_site">حضوری</SelectItem>
                <SelectItem value="hybrid">ترکیبی</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.sort} onValueChange={(value) => setFilters((prev) => ({ ...prev, sort: value }))}>
              <SelectTrigger>
                <SelectValue>
                  {eventSortOptions.find((option) => option.value === filters.sort)?.label ||
                    'مرتب‌سازی'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {eventSortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لیست رویدادها</CardTitle>
          <CardDescription>وضعیت، ظرفیت و قیمت هر رویداد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {eventsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
          ) : sortedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">رویدادی یافت نشد.</p>
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
                      <td className="px-3 py-2 text-right cursor-pointer" onClick={() => handleOpenDetail(event)}>
                        {event.title}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={statusConfig[event.status].variant}>
                          {statusConfig[event.status].label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{formatJalali(event.start_time)}</td>
                      <td className="px-3 py-2 text-right">{toPersianDigits(event.registration_count)}</td>
                      <td className="px-3 py-2 text-right">{formatToman(event.price)}</td>
                      <td className="px-3 py-2 text-left space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleOpenDetail(event)}>
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

      <EventDetailDialog
        eventId={detailEvent?.id ?? null}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
          else setDialogOpen(true);
        }}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })}
      />
    </div>
  );
};

export default AdminEventsPage;
