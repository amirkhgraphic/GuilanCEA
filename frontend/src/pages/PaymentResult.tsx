import { useEffect, useMemo, useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import Markdown from '@/components/Markdown';

type SavedPayment = {
  event_id: number;
  slug?: string;
  title?: string;
  thumb?: string | null;
  base_amount?: number;
  discount_amount?: number;
  amount?: number;
  started_at?: string;
  success_markdown?: string;

};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const status = params.get('status');         // success | failed
  const refId = params.get('ref_id') || '';
  const eventId = Number(params.get('event_id') || '0');

  const [fallback, setFallback] = useState<SavedPayment | null>(null);

  // 2) اگر saved نبود و refId هست، از بک‌اند اطلاعات را می‌گیریم (اندپوینت اختیاری by-ref)
  useEffect(() => {
    (async () => {
      if (!refId) return;
      try {
        const p = await api.getPaymentByRef(refId);
        setFallback({
          event_id: p.event.id,
          slug: p.event.slug,
          title: p.event.title,
          thumb: p.event.image_url || null,
          base_amount: p.base_amount,
          discount_amount: p.discount_amount,
          amount: p.amount,
          started_at: p.verified_at || undefined,
          success_markdown: p.event?.success_markdown
        });
      } catch {
        // بی‌صدا؛ حداقل status/ref_id نمایش داده می‌شود
      }
    })();
  }, [refId]);

  const data = fallback;

  const ok = status === 'success';
  const money = (n?: number) => typeof n === 'number' ? n.toLocaleString('fa-IR') : '—';
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const successMarkdown = data?.success_markdown ?? '';

  const siteUrl = 'https://east-guilan-ce.ir';
  const siteName = 'East Guilan CE';
  const canonicalUrl = `${siteUrl}/payments/result`;
  const toAbsoluteUrl = (url?: string | null) => {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    const normalizedSite = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const normalizedPath = url.startsWith('/') ? url.slice(1) : url;
    return `${normalizedSite}/${normalizedPath}`;
  };
  const eventTitle = data?.title || (eventId ? `Event #${eventId}` : 'Event payment');
  const referenceFragment = refId ? ` Reference: ${refId}.` : '';
  const pageState =
    status === 'success'
      ? 'Payment successful'
      : status === 'failed'
      ? 'Payment failed'
      : 'Payment status';
  const pageTitle = `${pageState} | ${siteName}`;
  const pageDescription = `${ok ? 'Payment confirmed' : 'Review your payment status'} for ${eventTitle}.${referenceFragment}`;
  const ogImage = toAbsoluteUrl(data?.thumb) ?? `${siteUrl}/favicon.ico`;
  const helmet = (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="fa_IR" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
  const renderWithHelmet = (node: JSX.Element) => (
    <>
      {helmet}
      {node}
    </>
  );

  const qrValue = useMemo(() => {
    // لینک قابل بررسی/اشتراک‌گذاری
    const base = window.location.origin;
    const url = new URL(`${base}/payments/result`);
    if (refId) url.searchParams.set('ref_id', refId);
    if (eventId) url.searchParams.set('event_id', String(eventId));
    url.searchParams.set('status', ok ? 'success' : 'failed');
    return url.toString();
  }, [refId, eventId, ok]);

  const handleDownloadPdf = async () => {
    const el = receiptRef.current;
    if (!el) return;

    // Force a light snapshot for the PDF
    const prevBg = el.style.backgroundColor;
    const prevColor = el.style.color;
    el.style.backgroundColor = '#ffffff';
    el.style.color = '#000000';

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      const x = (pageWidth - imgWidth) / 2;
      const y = 24;

      // (Optional) paint white page background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`receipt-${refId || eventId}.pdf`);
    } finally {
      // restore colors for on-screen
      el.style.backgroundColor = prevBg;
      el.style.color = prevColor;
    }
  };

  return renderWithHelmet(
    <div className="min-h-[60vh] flex items-center justify-center p-4 bg-background" dir="rtl">
      <Card className="w-full max-w-2xl bg-card text-card-foreground border-border">
        <CardHeader className="print:hidden">
          <CardTitle>نتیجهٔ پرداخت</CardTitle>
          <CardDescription>وضعیت تراکنش شما</CardDescription>
        </CardHeader>

        <CardContent>
          {/* RECEIPT AREA */}
          <div
            ref={receiptRef}
            className="rounded-lg border border-border p-4 md:p-6 bg-card text-card-foreground"
          >
            {/* Header (status + ref) */}
            <div
              className={[
                "rounded-md p-3 text-sm mb-4 border",
                ok
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/50"
                  : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/50",
              ].join(" ")}
            >
              {ok ? "پرداخت با موفقیت انجام شد." : "پرداخت ناموفق بود."}
            </div>

            {/* Event + QR */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {/* Thumb */}
              <div className="md:col-span-1">
                <div className="aspect-[16/9] overflow-hidden rounded-md bg-muted">
                  {data?.thumb ? (
                    <img
                      src={data.thumb}
                      alt={data?.title || ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                      بدون تصویر
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="md:col-span-1 space-y-1">
                <div className="text-sm text-muted-foreground">رویداد</div>
                <div className="font-semibold">{data?.title || `#${eventId || "—"}`}</div>

                {refId && (
                  <>
                    <div className="text-sm text-muted-foreground mt-3">کد پیگیری</div>
                    <div className="font-mono break-all">{refId}</div>
                  </>
                )}
              </div>

              {/* QR */}
              <div className="md:col-span-1 flex md:justify-end">
                <div className="p-3 border border-border rounded-md">
                  <QRCode value={qrValue} size={112} />
                  <div className="mt-2 text-[10px] text-center text-muted-foreground break-all">
                    {qrValue}
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-6 flex max-w-xl items-center justify-end gap-2">
              <Markdown content={successMarkdown} justify size="base" />
            </div>

            {/* Invoice */}
            <div className="mt-6 rounded-md border border-border p-3">
              <div className="text-sm font-medium mb-2">جزئیات پرداخت</div>
              <ul className="text-sm divide-y divide-border/60">
                <li className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">مبلغ پایه</span>
                  <span>{money(data?.base_amount / 10)} تومان</span>
                </li>
                <li className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">تخفیف</span>
                  <span>{money(data?.discount_amount / 10)} تومان</span>
                </li>
                <li className="flex items-center justify-between py-2 font-semibold">
                  <span>مبلغ نهایی</span>
                  <span>{money(data?.amount / 10)} تومان</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2 justify-end print:hidden">
            {data?.slug ? (
              <Link to={`/events/${data.slug}`}>
                <Button variant="outline">بازگشت به رویداد</Button>
              </Link>
            ) : (
              <Link to="/events">
                <Button variant="outline">رویدادها</Button>
              </Link>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              چاپ
            </Button>
            <Button onClick={handleDownloadPdf}>دانلود PDF</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
