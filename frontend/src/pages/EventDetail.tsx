import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
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

const typeLabel: Record<string, string> = { online: 'Ø¢Ù†Ù„Ø§ÛŒÙ†', on_site: 'Ø­Ø¶ÙˆØ±ÛŒ', hybrid: 'ØªØ±Ú©ÛŒØ¨ÛŒ' };

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
  const siteUrl = 'https://east-guilan-ce.ir';
  const siteName = 'انجمن علمی کامپیوتر شرق گیلان';
  const defaultDescription =
    'جزئیات کامل رویدادهای انجمن علمی کامپیوتر شرق گیلان شامل زمان، مکان و شرایط ثبت‌نام.';

  const toAbsoluteUrl = (url?: string | null) => {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    const normalizedSite = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const normalizedPath = url.startsWith('/') ? url.slice(1) : url;
    return `${normalizedSite}/${normalizedPath}`;
  };

  const sanitizeDescription = (value?: string | null) => {
    if (!value) return defaultDescription;
    const stripped = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!stripped) return defaultDescription;
    if (stripped.length <= 160) return stripped;
    return `${stripped.slice(0, 157)}...`;
  };

  const canonicalUrl = event ? `${siteUrl}/events/${event.slug}` : `${siteUrl}/events`;
  const primaryImage = event
    ? toAbsoluteUrl(getThumbUrl(event)) ?? `${siteUrl}/favicon.ico`
    : `${siteUrl}/favicon.ico`;
  const pageTitle = event ? `${event.title} | ${siteName}` : `جزئیات رویداد | ${siteName}`;
  const pageDescription = sanitizeDescription(event?.description);
  const pageRobots = event?.status === 'draft' ? 'noindex, nofollow' : 'index, follow';

  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

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

    toast({ title: 'ثبت‌نام با موفقیت انجام شد!', variant: 'success' });
    navigate(`/events/${event!.slug}/success${q}`);
  };

  const handleMainCTA = async () => {
    if (!event) return;
    if (!isAuthenticated) {
      toast({ title: 'ابتدا وارد شوید', description: 'برای ثبت‌نام در رویداد باید وارد حساب کاربری خود شوید.', variant: 'destructive' });
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
        if (msg.includes('already registered') || msg.includes('Ø«Ø¨Øªâ€ŒÙ†Ø§Ù…')) {
          setAlreadyRegistered(true);
          toast({ title: 'شما قبلاً ثبت‌نام کرده‌اید', variant: 'destructive' });
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
      toast({ title: 'ابتدا وارد شوید', description: 'برای ثبت‌نام در رویداد باید وارد حساب کاربری خود شوید.', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    try {
      setSubmitting(true);

      // 1) Ø§ÙˆÙ„ Ø«Ø¨Øªâ€ŒÙ†Ø§Ù… Ø±Ø§ Ø¨Ø³Ø§Ø² (Ø¯Ø± Ù‡Ø± Ø¯Ùˆ Ø­Ø§Ù„Øª)
      //    Ø¨Ù‡ØªØ±Ù‡ Ø®Ø±ÙˆØ¬ÛŒ Ø±Ùˆ Ù†Ú¯Ù‡ Ø¯Ø§Ø±ÛŒ Ø¨Ø±Ø§ÛŒ Ø±ÙØªÙ† Ø¨Ù‡ ØµÙØ­Ù‡Ù” Ù…ÙˆÙÙ‚ÛŒØª
      const reg = await api.registerForEvent(event.id); // Ø§Ù†ØªØ¸Ø§Ø±: { ticket_id: string }
      
      // 2) Ø§Ú¯Ø± Ù…Ø¨Ù„Øº Ù†Ù‡Ø§ÛŒÛŒ Ø§Ø² Ù…ÙˆØ¯Ø§Ù„ ØµÙØ±Ù‡ØŒ Ø§ØµÙ„Ø§Ù‹ Ù¾Ø±Ø¯Ø§Ø®Øª Ù†Ù…ÛŒâ€ŒØ®ÙˆØ§ÛŒÙ…
      if (finalAmount === 0) {
        // (Ø§Ø®ØªÛŒØ§Ø±ÛŒ) Ù‡Ø± Ú†ÛŒØ²ÛŒ Ú©Ù‡ Ø¯ÙˆØ³Øª Ø¯Ø§Ø±ÛŒ Ø¨Ø±Ø§ÛŒ Ø±Ø³ÛŒØ¯/Ø«Ø¨Øª Ù†Ú¯Ù‡ Ø¯Ø§Ø±ÛŒ
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
        return; // Ù…Ù‡Ù…: Ø§ÛŒÙ†Ø¬Ø§ Ø®Ø±ÙˆØ¬
      }

      const description = `پرداخت رویداد: ${event.title}`;
      const result = await api.createPayment({
        event_id: event.id,
        description,
        discount_code: (coupon ?? '').trim() || null,
      });

      // Ø§Ú¯Ø± Ø³Ø±ÙˆØ± Ù‡Ù… Ú¯ÙØª Ù…Ø¨Ù„Øº Ù†Ù‡Ø§ÛŒÛŒ 0 Ø§Ø³Øª ÛŒØ§ Ù„ÛŒÙ†Ú© Ø¯Ø±Ú¯Ø§Ù‡ Ù†Ø¯Ø§Ø¯ØŒ Ø¨Ø§Ø² Ù‡Ù… Ø§Ø³Ú©ÛŒÙ¾ Ú©Ù†
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

      // 4) Ù…Ø³ÛŒØ± Ù…Ø¹Ù…ÙˆÙ„ Ù¾Ø±Ø¯Ø§Ø®Øª
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
      // Ù‡Ù†Ø¯Ù„ Ø®Ø·Ø§ÛŒ Â«Ù‚Ø¨Ù„Ø§Ù‹ Ø«Ø¨Øªâ€ŒÙ†Ø§Ù… Ú©Ø±Ø¯Ù‡â€ŒØ§ÛŒØ¯Â» Ø¨Ø±Ø§ÛŒ Ø­Ø§Ù„Øª Ù¾Ø±Ø¯Ø§Ø®Øª ØµÙØ± Ù‡Ù… Ù…ÙÛŒØ¯Ù‡
      const msg = e?.message || '';
      if (msg.includes('already registered') || msg.includes('Ø«Ø¨Øªâ€ŒÙ†Ø§Ù…')) {
        setAlreadyRegistered(true);
        toast({ title: 'شما قبلاً ثبت‌نام کرده‌اید', variant: 'destructive' });
        return;
      }
      toast({ title: 'خطا در پردازش پرداخت', description: msg || 'لطفاً دوباره تلاش کنید.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setOpen(false);
    }
  };

  // -- Ø¯Ø±ÛŒØ§ÙØª Ø±ÙˆÛŒØ¯Ø§Ø¯
  useEffect(() => {
    (async () => {
      try {
        if (!slug) return;
        const data = await api.getEventBySlug(slug);
        setEvent(data);
      } catch (e: any) {
        toast({ title: 'خطا در بارگذاری رویداد', description: e?.message || 'لطفاً دوباره تلاش کنید.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // -- ØªØ§ÛŒÙ…Ø± ÙÙ‚Ø· ØªØ§ Ù¾Ø§ÛŒØ§Ù† Ù…Ù‡Ù„Øª Ø«Ø¨Øªâ€ŒÙ†Ø§Ù…
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

  // Ø§Ø¹Ø¯Ø§Ø¯ ÙØ§Ø±Ø³ÛŒ
  const nfd = useMemo(
    () => new Intl.NumberFormat('fa-IR', { useGrouping: false }),
    []
  );
  // Ø¯Ùˆ Ø±Ù‚Ù…ÛŒ Ø¨Ø±Ø§ÛŒ Ø³Ø§Ø¹Øª/Ø¯Ù‚ÛŒÙ‚Ù‡/Ø«Ø§Ù†ÛŒÙ‡
  const nf2 = useMemo(
    () => new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2, useGrouping: false }),
    []
  );
  // Ø®Ø±ÙˆØ¬ÛŒ: Û±Û² Ø±ÙˆØ² Ùˆ Û°Û³ Ø³Ø§Ø¹Øª Ùˆ Û°Û² Ø¯Ù‚ÛŒÙ‚Ù‡ Ùˆ Û°Û¸ Ø«Ø§Ù†ÛŒÙ‡
  const formatRemainingWords = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (days === 0) return `${nf2.format(hours)} Ø³Ø§Ø¹Øª Ùˆ ${nf2.format(minutes)} Ø¯Ù‚ÛŒÙ‚Ù‡ Ùˆ ${nf2.format(seconds)} Ø«Ø§Ù†ÛŒÙ‡`;
    return `${nfd.format(days)} Ø±ÙˆØ² Ùˆ ${nf2.format(hours)} Ø³Ø§Ø¹Øª Ùˆ ${nf2.format(minutes)} Ø¯Ù‚ÛŒÙ‚Ù‡ Ùˆ ${nf2.format(seconds)} Ø«Ø§Ù†ÛŒÙ‡`;
  };
``
  // -- Ù…Ù†Ø·Ù‚ Ø¨Ø§Ø²/Ø¨Ø³ØªÙ‡ Ø¨ÙˆØ¯Ù† Ø«Ø¨Øªâ€ŒÙ†Ø§Ù… (Ø´Ø±ÙˆØ¹ Ùˆ Ù¾Ø§ÛŒØ§Ù† Ø±Ø§ Ù„Ø­Ø§Ø¸ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ…Ø› UI Ø´Ø±ÙˆØ¹ Ø±Ø§ Ù†Ø´Ø§Ù† Ù†Ù…ÛŒâ€ŒØ¯Ù‡ÛŒÙ…)
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
  const eventStructuredData = useMemo(() => {
    if (!event) return null;

    const attendanceModeMap: Record<string, string> = {
      online: 'https://schema.org/OnlineEventAttendanceMode',
      on_site: 'https://schema.org/OfflineEventAttendanceMode',
      hybrid: 'https://schema.org/MixedEventAttendanceMode',
    };

    const statusMap: Record<string, string> = {
      published: 'https://schema.org/EventScheduled',
      completed: 'https://schema.org/EventCompleted',
      cancelled: 'https://schema.org/EventCancelled',
      draft: 'https://schema.org/EventPostponed',
    };

    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.title,
      description: pageDescription,
      startDate: event.start_time,
      url: canonicalUrl,
      eventAttendanceMode: attendanceModeMap[event.event_type] ?? attendanceModeMap.hybrid,
      eventStatus: statusMap[event.status] ?? statusMap.published,
      organizer: {
        '@type': 'Organization',
        name: siteName,
        url: siteUrl,
      },
    };

    if (event.end_time) {
      data.endDate = event.end_time;
    }

    if (primaryImage) {
      data.image = [primaryImage];
    }

    if (event.event_type === 'online') {
      data.location = {
        '@type': 'VirtualLocation',
        url: event.online_link || canonicalUrl,
      };
    } else {
      const location: Record<string, unknown> = {
        '@type': 'Place',
        name: event.location || event.address || siteName,
      };
      if (event.address) {
        location.address = event.address;
      }
      if (event.location) {
        location.description = event.location;
      }
      data.location = location;
    }

    const offers: Record<string, unknown> = {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'IRR',
      price: String(event.price ?? 0),
      availability: meta?.full ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    };

    if (event.registration_start_date) {
      offers.validFrom = event.registration_start_date;
    }
    if (event.registration_end_date) {
      offers.validThrough = event.registration_end_date;
    }

    data.offers = offers;

    return data;
  }, [event, pageDescription, canonicalUrl, primaryImage, meta?.full, siteName, siteUrl]);

  const helmet = (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="robots" content={pageRobots} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content="event" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={primaryImage} />
      <meta property="og:locale" content="fa_IR" />
      {event?.start_time && <meta property="event:start_time" content={event.start_time} />}
      {event?.end_time && <meta property="event:end_time" content={event.end_time} />}
      {event?.updated_at && <meta property="og:updated_time" content={event.updated_at} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={primaryImage} />
      {eventStructuredData && (
        <script type="application/ld+json">{JSON.stringify(eventStructuredData)}</script>
      )}
    </Helmet>
  );

  const withHelmet = (node: JSX.Element) => (
    <>
      {helmet}
      {node}
    </>
  );

  if (loading) {
    return withHelmet(
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">در حال بارگذاری رویداد...</div>
    );
  }
  if (!event) {
    return withHelmet(
      <div className="min-h-[60vh] flex items-center justify-center">رویداد مورد نظر یافت نشد.</div>
    );
  }

  // ÙˆØ¶Ø¹ÛŒØªâ€ŒÙ‡Ø§ÛŒ Ù†Ù…Ø§ÛŒØ´ Ù¾ÛŒØ§Ù… Ø¨Ø§Ù„Ø§ÛŒ ØµÙØ­Ù‡
  const beforeStart = rsTs != null && nowTs < rsTs;
  const ended = deadlineTs !== null && remainingMs === 0;
  const showCountdown = !beforeStart && deadlineTs !== null && remainingMs! > 0;

  return withHelmet(
    <div className="container mx-auto px-4 py-8" dir="rtl">
      {/* --- Ù†ÙˆØ§Ø± Ø§Ø·Ù„Ø§Ø¹/ØªØ§ÛŒÙ…Ø± Ø²ÛŒØ± Ù†ÙˆØ§Ø± Ù†Ø§ÙˆØ¨Ø±ÛŒ Ø¨Ø§ Ø±Ù†Ú¯â€ŒÙ‡Ø§ÛŒ Ù…Ù†Ø§Ø³Ø¨ Light/Dark --- */}
      {beforeStart && (
        <div className="mb-6">
          <div className="rounded-xl border p-4 text-center bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-100 dark:border-sky-800">
            ثبت‌نام از <strong className="font-semibold">{formatJalali(event.registration_start_date!)}</strong> آغاز می‌شود.
          </div>
        </div>
      )}

      {showCountdown && (
        <div className="mb-6">
          <div className="rounded-xl border p-4 text-center bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800">
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center">
              <span>زمان باقی‌مانده تا پایان ثبت‌نام:</span>
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
            مهلت ثبت‌نام به پایان رسیده است.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ù…Ø­ØªÙˆØ§ */}
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
                    {event.end_time ? ` â€” ${formatJalali(event.end_time)}` : null}
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

          {/* Ú¯Ø§Ù„Ø±ÛŒ */}
          {event.gallery_images?.length ? (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">گالری تصاویر</h3>
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

        {/* Ø³Ø§ÛŒØ¯Ø¨Ø§Ø± Ø§Ø·Ù„Ø§Ø¹Ø§Øª */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">اطلاعات ثبت‌نام</CardTitle>
                <CardDescription>جزئیات دسترسی به رویداد</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {event.address && <div>آدرس: {event.address}</div>}
                {event.online_link && (
                  <div className="truncate">
                    لینک برگزاری: <a className="underline" href={event.online_link} target="_blank" rel="noreferrer">{event.online_link}</a>
                  </div>
                )}
                <div>ظرفیت کل: {event.capacity == null ? 'نامحدود' : event.capacity.toLocaleString('fa-IR')}</div>
                {meta && (
                  <>
                    {!event.capacity ? null : (
                      <div>
                        ظرفیت باقی‌مانده: {meta.remaining === Infinity ? 'نامحدود' : meta.remaining.toLocaleString('fa-IR')}
                      </div>
                    )}
                  </>
                )}
                <div>هزینه حضور: {event.price ? `${(event.price / 10).toLocaleString('fa-IR')} تومان` : 'رایگان'}</div>

                {/* Ù†Ù…Ø§ÛŒØ´ Ø²Ù…Ø§Ù† Ø´Ø±ÙˆØ¹/Ù¾Ø§ÛŒØ§Ù† Ø«Ø¨Øªâ€ŒÙ†Ø§Ù… Ø¯Ø± UI Ø­Ø°Ù Ø´Ø¯Ù‡ */}

                <Button
                  onClick={handleMainCTA}
                  className="w-full mt-2"
                  disabled={
                    submitting ||
                    alreadyRegistered ||
                    event.status !== 'published' ||
                    meta?.full === true ||
                    !meta?.registrationOpen // Ù‚Ø¨Ù„ Ø§Ø² Ø´Ø±ÙˆØ¹ ÛŒØ§ Ù¾Ø³ Ø§Ø² Ù¾Ø§ÛŒØ§Ù†
                  }
                >
                  {event.status !== 'published'
                    ? 'ثبت‌نام این رویداد فعال نیست'
                    : alreadyRegistered
                    ? 'شما قبلاً ثبت‌نام کرده‌اید'
                    : !meta?.registrationOpen
                    ? 'ثبت‌نام هنوز آغاز نشده است'
                    : meta?.full
                    ? 'ظرفیت ثبت‌نام تکمیل شده است'
                    : submitting
                    ? 'Ø¯Ø± Ø­Ø§Ù„ Ø«Ø¨Øªâ€ŒÙ†Ø§Ù…...'
                    : event.price === 0
                    ? 'ثبت‌نام (رایگان)'
                    : 'ثبت‌نام و ادامه پرداخت'
                  }
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









