import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type * as Types from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Markdown from '@/components/Markdown';
import CouponDialogFa from '@/components/CouponDialogFa';
import { formatJalali, getThumbUrl } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const typeLabel: Record<string, string> = { online: 'آنلاین', on_site: 'حضوری', hybrid: 'ترکیبی' };

export default function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [event, setEvent] = useState<Types.EventDetailSchema | null>(null);
  const [loading, setLoading] = useState(true);

  const basePrice = Number(event?.price ?? 0);
  const isFree = useMemo(() => basePrice <= 0, [basePrice]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // -- وضعیت ثبت‌نام کاربر
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (isAuthenticated && event?.id) {
        try {
          const res = await api.getRegistrationStatus(event.id);
          if (!cancelled) setAlreadyRegistered(res.is_registered);
        } catch { /* ignore */ }
      }
    }
    check();
    return () => { cancelled = true; };
  }, [isAuthenticated, event?.id]);

  const goSuccess = (registrationId?: string) => {
    const q = registrationId ? `?registration_id=${registrationId}` : '';
    setAlreadyRegistered(true);
    toast({ title: 'ثبت‌نام موفقیت‌آمیز بود!', variant: 'success' });
    navigate(`/events/${event!.slug}/success${q}`);
  };

  const handleMainCTA = async () => {
    if (!event) return;
    if (!isAuthenticated) {
      toast({ title: 'ابتدا وارد شوید', description: 'برای ثبت‌نام نیاز به ورود دارید.', variant: 'destructive' });
      navigate('/auth');
      return;
    }
    if (isFree) {
      try {
        setSubmitting(true);
        const res = await api.registerForEvent(event.id);
        goSuccess(res.ticket_id);
      } catch (e: any) {
        const msg = e?.message || '';
        if (msg.includes('already registered') || msg.includes('ثبت‌نام')) {
          setAlreadyRegistered(true);
          toast({ title: 'قبلاً ثبت‌نام کرده‌اید', variant: 'destructive' });
          return;
        }
        throw e;
      } finally {
        setSubmitting(false);
      }
    } else {
      setOpen(true);
    }
  };

  const handleContinueFromModal = async (coupon?: string, finalAmount?: number) => {
    if (!event) return;
    if (!isAuthenticated) {
      toast({ title: 'ابتدا وارد شوید', description: 'برای ثبت‌نام نیاز به ورود دارید.', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    try {
      setSubmitting(true);

      // 1) اول ثبت‌نام را بساز (در هر دو حالت)
      //    بهتره خروجی رو نگه داری برای رفتن به صفحهٔ موفقیت
      const reg = await api.registerForEvent(event.id); // انتظار: { ticket_id: string }
      
      // 2) اگر مبلغ نهایی از مودال صفره، اصلاً پرداخت نمی‌خوایم
      if (finalAmount === 0) {
        // (اختیاری) هر چیزی که دوست داری برای رسید/ثبت نگه داری
        sessionStorage.setItem('payment:last', JSON.stringify({
          event_id: event.id,
          slug: event.slug,
          title: event.title,
          thumb:
            (event as any).absolute_thumbnail_url ||
            (event as any).thumbnail_url ||
            (event as any).absolute_featured_image_url ||
            null,
          base_amount: Number(event.price ?? 0),
          discount_amount: Number(event.price ?? 0),
          amount: 0,
          started_at: new Date().toISOString(),
          success_markdown: event.registration_success_markdown,

        }));
        api.ChangeRegistrationStatus(reg.id, 'confirmed')
        goSuccess(reg?.ticket_id);
        return; // مهم: اینجا خروج
      }

      // 3) در غیر اینصورت، پرداخت بساز
      const description = `پرداخت ثبت‌نام رویداد: ${event.title}`;
      const result = await api.createPayment({
        event_id: event.id,
        description,
        discount_code: (coupon ?? '').trim() || null,
      });

      // اگر سرور هم گفت مبلغ نهایی 0 است یا لینک درگاه نداد، باز هم اسکیپ کن
      if (!result?.start_pay_url || Number(result.amount) === 0) {
        sessionStorage.setItem('payment:last', JSON.stringify({
          event_id: event.id,
          slug: event.slug,
          title: event.title,
          thumb:
            (event as any).absolute_thumbnail_url ||
            (event as any).thumbnail_url ||
            (event as any).absolute_featured_image_url ||
            null,
          base_amount: result.base_amount,
          discount_amount: result.discount_amount ?? result.base_amount,
          amount: 0,
          started_at: new Date().toISOString(),
          success_markdown: event.registration_success_markdown,
        }));
        goSuccess(reg?.ticket_id);
        return;
      }

      // 4) مسیر معمول پرداخت
      sessionStorage.setItem('payment:last', JSON.stringify({
        event_id: event.id,
        slug: event.slug,
        title: event.title,
        thumb:
          (event as any).absolute_thumbnail_url ||
          (event as any).thumbnail_url ||
          (event as any).absolute_featured_image_url ||
          null,
        base_amount: result.base_amount,
        discount_amount: result.discount_amount,
        amount: result.amount,
        started_at: new Date().toISOString(),
        success_markdown: event.registration_success_markdown,
      }));
      window.location.href = result.start_pay_url;

    } catch (e: any) {
      // هندل خطای «قبلاً ثبت‌نام کرده‌اید» برای حالت پرداخت صفر هم مفیده
      const msg = e?.message || '';
      if (msg.includes('already registered') || msg.includes('ثبت‌نام')) {
        setAlreadyRegistered(true);
        toast({ title: 'قبلاً ثبت‌نام کرده‌اید', variant: 'destructive' });
        return;
      }
      toast({ title: 'خطا در شروع پرداخت', description: msg || 'مشکلی رخ داد', variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setOpen(false);
    }
  };

  // -- دریافت رویداد
  useEffect(() => {
    (async () => {
      try {
        if (!slug) return;
        const data = await api.getEventBySlug(slug);
        setEvent(data);
      } catch (e: any) {
        toast({ title: 'خطا در دریافت رویداد', description: e?.message || 'مشکلی رخ داد', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // -- تایمر فقط تا پایان مهلت ثبت‌نام
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const rsTs = useMemo<number | null>(() => (
    event?.registration_start_date ? new Date(event.registration_start_date).getTime() : null
  ), [event?.registration_start_date]);

  const deadlineTs = useMemo<number | null>(() => (
    event?.registration_end_date ? new Date(event.registration_end_date).getTime() : null
  ), [event?.registration_end_date]);

  const remainingMs = useMemo<number | null>(() => (
    deadlineTs != null ? Math.max(0, deadlineTs - nowTs) : null
  ), [deadlineTs, nowTs]);

  // اعداد فارسی
  const nfd = useMemo(
    () => new Intl.NumberFormat('fa-IR', { useGrouping: false }),
    []
  );
  // دو رقمی برای ساعت/دقیقه/ثانیه
  const nf2 = useMemo(
    () => new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2, useGrouping: false }),
    []
  );
  // خروجی: ۱۲ روز و ۰۳ ساعت و ۰۲ دقیقه و ۰۸ ثانیه
  const formatRemainingWords = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (days === 0) return `${nf2.format(hours)} ساعت و ${nf2.format(minutes)} دقیقه و ${nf2.format(seconds)} ثانیه`;
    return `${nfd.format(days)} روز و ${nf2.format(hours)} ساعت و ${nf2.format(minutes)} دقیقه و ${nf2.format(seconds)} ثانیه`;
  };
``
  // -- منطق باز/بسته بودن ثبت‌نام (شروع و پایان را لحاظ می‌کنیم؛ UI شروع را نشان نمی‌دهیم)
  const meta = useMemo(() => {
    if (!event) return null;
    const rs = rsTs;
    const re = deadlineTs;
    const registrationOpen = (rs == null || nowTs >= rs) && (re == null || nowTs <= re);
    const unlimited = event.capacity == null;
    const remaining = unlimited ? Infinity : Math.max(0, (event.capacity || 0) - (event.registration_count || 0));
    const full = !unlimited && remaining <= 0;
    return { registrationOpen, remaining, full };
  }, [event, rsTs, deadlineTs, nowTs]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">در حال بارگذاری...</div>
    );
  }
  if (!event) {
    return <div className="min-h-[60vh] flex items-center justify-center">رویداد پیدا نشد</div>;
  }

  // وضعیت‌های نمایش پیام بالای صفحه
  const beforeStart = rsTs != null && nowTs < rsTs;
  const ended = deadlineTs !== null && remainingMs === 0;
  const showCountdown = !beforeStart && deadlineTs !== null && remainingMs! > 0;

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      {/* --- نوار اطلاع/تایمر زیر نوار ناوبری با رنگ‌های مناسب Light/Dark --- */}
      {beforeStart && (
        <div className="mb-6">
          <div className="rounded-xl border p-4 text-center bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-100 dark:border-sky-800">
            ثبت‌نام از <strong className="font-semibold">{formatJalali(event.registration_start_date!)}</strong> باز می‌شود.
          </div>
        </div>
      )}

      {showCountdown && (
        <div className="mb-6">
          <div className="rounded-xl border p-4 text-center bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800">
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center">
              <span>زمان باقیمانده تا پایان ثبت‌نام:</span>
              <strong className="font-extrabold tracking-wider sm:ms-1">
                {formatRemainingWords(remainingMs!)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {ended && (
        <div className="mb-6">
          <div className="rounded-xl border p-4 text-center bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-800">
            مهلت ثبت‌نام به پایان رسید
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* محتوا */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="w-full aspect-video overflow-hidden rounded-lg">
              <img
                src={getThumbUrl(event)}
                alt={event.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>

            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl">{event.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {formatJalali(event.start_time)}
                    {event.end_time ? ` — ${formatJalali(event.end_time)}` : null}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="default">{typeLabel[event.event_type] || event.event_type}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Markdown content={event.description} justify size="base" />
            </CardContent>
          </Card>

          {/* گالری */}
          {event.gallery_images?.length ? (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">گالری</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {event.gallery_images.map((g) => (
                  <img
                    key={g.id}
                    src={g.absolute_image_url || ''}
                    alt={g.title || ''}
                    className="w-full h-36 object-cover rounded-md"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* سایدبار اطلاعات */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">جزئیات رویداد</CardTitle>
                <CardDescription>اطلاعات تکمیلی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {event.address && <div>📍 {event.address}</div>}
                {event.online_link && (
                  <div className="truncate">
                    🔗 <a className="underline" href={event.online_link} target="_blank" rel="noreferrer">{event.online_link}</a>
                  </div>
                )}
                <div>ظرفیت: {event.capacity == null ? 'نامحدود' : event.capacity.toLocaleString('fa-IR')}</div>
                {meta && (
                  <>
                    {!event.capacity ? null : (
                      <div>
                        ظرفیت باقیمانده: {meta.remaining === Infinity ? 'نامحدود' : meta.remaining.toLocaleString('fa-IR')}
                      </div>
                    )}
                  </>
                )}
                <div>هزینه: {event.price ? `${(event.price / 10).toLocaleString('fa-IR')} تومان` : 'رایگان'}</div>

                {/* نمایش زمان شروع/پایان ثبت‌نام در UI حذف شده */}

                <Button
                  onClick={handleMainCTA}
                  className="w-full mt-2"
                  disabled={
                    submitting ||
                    alreadyRegistered ||
                    event.status !== 'published' ||
                    meta?.full === true ||
                    !meta?.registrationOpen // قبل از شروع یا پس از پایان
                  }
                >
                  {event.status !== 'published'
                    ? 'غیرقابل ثبت‌نام'
                    : alreadyRegistered
                    ? 'قبلاً ثبت‌نام کرده‌اید'
                    : !meta?.registrationOpen
                    ? 'ثبت‌نام باز نیست'
                    : meta?.full
                    ? 'ظرفیت تکمیل'
                    : submitting
                    ? 'در حال ثبت‌نام...'
                    : event.price === 0
                    ? 'ثبت‌نام (رایگان)'
                    : `ثبت‌نام و پرداخت`}
                </Button>

                {!isFree && (
                  <CouponDialogFa
                    open={open}
                    onOpenChange={setOpen}
                    basePrice={basePrice}
                    onVerifyCouponRaw={(code) => api.checkDiscountCode(event.id, code)}
                    onContinue={handleContinueFromModal}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
