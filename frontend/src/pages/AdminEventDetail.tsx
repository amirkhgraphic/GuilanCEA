import * as React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { formatJalali, formatToman, resolveErrorMessage, toPersianDigits } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const registrationStatusOptions = ['confirmed', 'pending', 'cancelled'] as const;
const REGISTRATIONS_PAGE_SIZE = 10;

export default function AdminEventDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user, isAuthenticated, loading } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState<typeof registrationStatusOptions[number] | 'all'>('all');
  const [search, setSearch] = React.useState('');
  const [regPage, setRegPage] = React.useState(1);

  const eventId = Number(id);
  const detailQuery = useQuery({
    queryKey: ['admin', 'event-detail', eventId],
    queryFn: () => api.getEventAdminDetail(eventId),
    enabled: Number.isFinite(eventId),
  });

  const registrationsQuery = useQuery({
    queryKey: ['admin', 'event', eventId, 'registrations', statusFilter, search, regPage],
    enabled: Number.isFinite(eventId),
    queryFn: () =>
      api.listEventRegistrationsAdmin(eventId, {
        statuses: statusFilter === 'all' ? registrationStatusOptions : [statusFilter],
        search: search || undefined,
        limit: REGISTRATIONS_PAGE_SIZE,
        offset: (regPage - 1) * REGISTRATIONS_PAGE_SIZE,
      }),
  });

  React.useEffect(() => {
    if (detailQuery.error) {
      toast({ title: 'خطا در دریافت جزئیات رویداد', description: resolveErrorMessage(detailQuery.error), variant: 'destructive' });
    }
  }, [detailQuery.error, toast]);

  React.useEffect(() => {
    if (registrationsQuery.error) {
      toast({ title: 'خطا در ثبت‌نام‌ها', description: resolveErrorMessage(registrationsQuery.error), variant: 'destructive' });
    }
  }, [registrationsQuery.error, toast]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground" dir="rtl">در حال بارگذاری...</div>;
  }
  if (!isAuthenticated || !(user?.is_staff || user?.is_superuser)) {
    return <Navigate to="/" replace />;
  }
  if (!Number.isFinite(eventId)) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">شناسه رویداد معتبر نیست.</div>;
  }

  const event = detailQuery.data;
  const paged = registrationsQuery.data;
  const registrationPageCount = paged ? Math.max(1, Math.ceil(paged.count / REGISTRATIONS_PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{event?.title ?? 'جزئیات رویداد'}</h1>
            {event && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                <Badge variant="secondary">{event.status_label ?? event.status}</Badge>
                {event.start_time ? <span>شروع: {formatJalali(event.start_time)}</span> : null}
                {event.event_type ? <span>نوع: {event.event_type_label ?? event.event_type}</span> : null}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/admin/events/${eventId}/edit`}>ویرایش پیشرفته</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/events">بازگشت</Link>
            </Button>
          </div>
        </div>

        {event && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>وضعیت</CardTitle>
                <CardDescription>اطلاعات پایه رویداد</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>ظرفیت: {event.capacity ?? 'نامحدود'}</div>
                <div>ثبت‌نام‌ها: {toPersianDigits(event.registration_count ?? 0)}</div>
                <div>قیمت: {formatToman(event.price)}</div>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>توضیحات</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-6">
                {event.description || 'توضیحی ثبت نشده است.'}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>ثبت‌نام‌ها و پرداخت‌ها</CardTitle>
            <CardDescription>لیست ثبت‌نام‌های مرتبط با این رویداد</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as typeof statusFilter); setRegPage(1); }}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="وضعیت">وضعیت: {statusFilter === 'all' ? 'همه' : statusFilter}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه</SelectItem>
                    {registrationStatusOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="md:w-64"
                placeholder="جستجو نام/ایمیل/نام‌کاربری"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setRegPage(1); }}
              />
            </div>

            {registrationsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">در حال بارگذاری ثبت‌نام‌ها...</p>
            ) : !paged || paged.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">ثبت‌نامی یافت نشد.</p>
            ) : (
              <ScrollArea className="rounded-md border max-h-[70vh]">
                <div className="divide-y">
                  {paged.results.map((registration) => (
                    <div key={registration.id} className="p-4">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-semibold">{registration.user.first_name} {registration.user.last_name}</div>
                          <div className="text-xs text-muted-foreground">{registration.user.email}</div>
                        </div>
                        <Badge variant={registration.status === 'confirmed' ? 'default' : 'outline'}>
                          {registration.status_label}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2 lg:grid-cols-3">
                        <div>نام‌کاربری: {registration.user.username}</div>
                        <div>کد بلیت: {registration.ticket_id}</div>
                        <div>تاریخ ثبت‌نام: {formatJalali(registration.registered_at)}</div>
                        <div>مبلغ پرداختی: {formatToman(registration.final_price ?? 0)}</div>
                        <div>تخفیف: {formatToman(registration.discount_amount ?? 0)}</div>
                      </div>
                      {registration.payments.length > 0 && (
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="font-medium">پرداخت‌ها</div>
                          {registration.payments.map((payment) => (
                            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1">
                              <span className="text-muted-foreground">{payment.status_label}</span>
                              <span>{formatToman(payment.amount)}</span>
                              <span className="text-muted-foreground text-[11px]">Ref: {payment.ref_id ?? '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>صفحه {toPersianDigits(regPage)} از {toPersianDigits(registrationPageCount)}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={regPage <= 1} onClick={() => setRegPage((p) => Math.max(1, p - 1))}>
                  قبلی
                </Button>
                <Button size="sm" variant="outline" disabled={regPage >= registrationPageCount} onClick={() => setRegPage((p) => p + 1)}>
                  بعدی
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
