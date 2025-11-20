import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { EventListItemSchema } from '@/lib/types';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { formatJalali, formatToman, getThumbUrl, resolveErrorMessage, toPersianDigits } from '@/lib/utils';

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

const eventSortOptions = [
  { value: 'newest', label: 'جدیدترین شروع' },
  { value: 'oldest', label: 'قدیمی‌ترین شروع' },
  { value: 'priceAsc', label: 'قیمت صعودی' },
  { value: 'priceDesc', label: 'قیمت نزولی' },
];

const AdminEventsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
            <div className="space-y-4">
              <div className="hidden md:block">
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
                          <td className="px-3 py-2 text-right cursor-pointer" onClick={() => navigate(`/admin/events/${event.id}`)}>
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
                          <td className="px-3 py-2 text-left flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/admin/events/${event.id}`)}>
                              جزئیات
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/admin/events/${event.id}/edit`}>ویرایش</Link>
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
              </div>

              <div className="grid gap-3 md:hidden">
                {sortedEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3 space-y-2 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-right">{event.title}</div>
                      <Badge variant={statusConfig[event.status].variant}>{statusConfig[event.status].label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground text-right space-y-1">
                      <div>تاریخ شروع: {formatJalali(event.start_time)}</div>
                      <div>ثبت‌نام‌ها: {toPersianDigits(event.registration_count)}</div>
                      <div>قیمت: {formatToman(event.price)}</div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/events/${event.id}`)}>
                        جزئیات
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/admin/events/${event.id}/edit`}>ویرایش</Link>
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(event.id)}>
                        حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEventsPage;
