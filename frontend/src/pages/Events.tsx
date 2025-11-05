import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type * as Types from '@/lib/types';
import { formatJalali, getThumbUrl } from '@/lib/utils';


function labelPrice(event: any) {
  const price = Number(event?.price ?? 0);
  return price <= 0 ? "رایگان" : `${price.toLocaleString("fa-IR")} تومان`;
}
function modeFa(event_type: any) {
  return event_type === "online" ? "آنلاین" : "حضوری";
}
function spotsLeft(event: any) {
  const cap = Number(event.capacity);
  const used = Number(event.registration_count);
  const left = cap - used;
  return left;
}
function isAvailable(event: any) {
  const now = new Date();
  const end = new Date(event.registration_end_date);
  const timeOk = end.getTime() > now.getTime();
  const left = spotsLeft(event);
  return timeOk && left > 0;
}
function notAvailableReasonFa(event: any) {
  const now = new Date();
  const end = new Date(event.registration_end_date);
  if (end.getTime() <= now.getTime()) return "ثبت‌نام پایان‌یافته";
  const left = spotsLeft(event);
  if (left <= 0) return "ظرفیت تکمیل";
  return "غیرقابل ثبت‌نام";
}

export default function Events() {
  const [events, setEvents] = useState<Types.EventListItemSchema[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, [search]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await api.getEvents({
        search: search || undefined,
        statuses: ['published', 'completed'],
        limit: 30,
      });
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">رویدادها</h1>

        <div className="mb-8">
          <Input
            type="text"
            placeholder="جستجو در رویدادها..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">در حال بارگذاری...</p>
        ) : events.length === 0 ? (
          <p className="text-center text-muted-foreground">رویدادی یافت نشد</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.slug}`} className="block h-full">
                <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                  <div className="w-full aspect-video overflow-hidden rounded-lg">
                    <img
                      src={getThumbUrl(event)}
                      alt={event.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  {/* این رپر حالا قدِ باقی‌مانده رو می‌گیره */}
                  <div className="flex-1 flex flex-col justify-between">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2">{event.title}</CardTitle>
                        <Badge variant="default">{modeFa(event.event_type)}</Badge>
                      </div>
                      <CardDescription>{formatJalali(event.start_time)}</CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="grid gap-1 text-sm" dir="rtl">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">ظرفیت رویداد</span>
                          <span className="font-medium">
                            {(Number(event?.capacity ?? 0) - Number(event?.registration_count ?? 0)).toLocaleString("fa-IR")}/{Number(event?.capacity ?? 0).toLocaleString("fa-IR")} نفر
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">هزینه‌ی ثبت‌نام</span>
                          <span className="font-medium">{labelPrice(event)}</span>
                        </div>
                        {isAvailable(event) ? (
                          <Button>جزئیات رویداد</Button>
                        ) : (
                          <Button variant="secondary">{notAvailableReasonFa(event)}</Button>
                        )}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
