import { useLocation, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import PaymentResult from "@/components/PaymentResult";
import { formatJalali } from "@/lib/utils";
import Markdown from '@/components/Markdown';
import { Helmet } from "react-helmet-async";

export default function EventFreeSuccessPage() {
  const { slug } = useParams();
  const search = new URLSearchParams(useLocation().search);
  const registrationId = search.get("registration_id") || "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["registration-verify", registrationId],
    queryFn: () =>
      registrationId ? api.verifyMyRegistration(registrationId) : Promise.resolve(null),
    enabled: Boolean(registrationId),
  });

  const registrationCodeFull = (data?.ticket_id || registrationId || "").trim();
  const registrationCodeShort = registrationCodeFull
    ? (registrationCodeFull.split("-")[0] || registrationCodeFull).slice(0, 8)
    : "";

  const siteUrl = 'https://east-guilan-ce.ir';
  const siteName = 'East Guilan CE';
  const canonicalUrl = slug ? `${siteUrl}/events/${slug}/success` : `${siteUrl}/events`;
  const registrationTitle = data?.event_title || slug || 'Event registration';
  const ticketSummary = registrationCodeShort ? ` Ticket: ${registrationCodeShort}.` : '';
  const pageState = isLoading
    ? 'Verifying registration'
    : isError || !data
    ? 'Registration not found'
    : 'Registration confirmed';
  const pageTitle = `${pageState} | ${siteName}`;
  const registrationCode = registrationId || 'your registration';
  const pageDescription = data
    ? `Registration confirmed for ${registrationTitle}.${ticketSummary}`
    : isError
    ? `We could not verify ${registrationCode}.`
    : registrationId
    ? `Verifying registration ${registrationId} for ${registrationTitle}.`
    : 'Review your registration status and ticket details.';
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
      <meta property="og:image" content={`${siteUrl}/favicon.ico`} />
      <meta property="og:locale" content="fa_IR" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={`${siteUrl}/favicon.ico`} />
    </Helmet>
  );

  const renderWithHelmet = (node: JSX.Element) => (
    <>
      {helmet}
      {node}
    </>
  );

  if (isLoading) {
    return renderWithHelmet(
      <div className="container py-10" dir="rtl">
        در حال بارگذاری...
      </div>
    );
  }

  // اگر بک‌اند چیزی برنگرداند یا خطا داد
  if (!data || isError) {
    return renderWithHelmet(
      <div className="container py-10" dir="rtl">
        <PaymentResult
          title="اطلاعات ثبت‌نام در دسترس نیست"
          subtitle="امکان دریافت جزئیات ثبت‌نام فراهم نشد. اگر مبلغی پرداخت نشده، ثبت‌نام شما برای رویداد رایگان انجام شده است."
          details={[
            { label: "کد ثبت‌نام", value: registrationCodeShort || "—" },
            { label: "رویداد", value: slug || "—" },
            { label: "مبلغ", value: "رایگان" },
          ]}
        />
        <div className="mx-auto mt-6 flex max-w-xl items-center justify-end gap-2">
          <Link to={`/events/${slug || ""}`}>
            <Button variant="outline">بازگشت به رویداد</Button>
          </Link>
          <Link to="/events">
            <Button>مشاهده سایر رویدادها</Button>
          </Link>
        </div>
      </div>
    );
  }

  const details = [
    { label: "عنوان رویداد", value: data.event_title || (slug || "—") },
    { label: "شیوه برگزاری", value: data.event_type || "—" },
    { label: "کد ثبت‌نام",
      value: <code dir="ltr" className="font-mono bg-muted px-2 py-0.5 rounded">{registrationCodeShort || "—"}</code>
    },
    { label: "وضعیت", value: faStatus(data.status) },
    ...(data.registered_at ? [{ label: "تاریخ ثبت‌نام", value: formatJalali(data.registered_at) }] : []),
    { label: "مبلغ", value: "رایگان" },
  ];

  return renderWithHelmet(
    <div className="container py-10" dir="rtl">
      <PaymentResult
        title="ثبت‌نام با موفقیت انجام شد 🎉"
        subtitle={`شما با موفقیت برای «${data.event_title || "رویداد"}» ثبت‌نام کرده‌اید.`}
        details={details}
      />

      <div className="mx-auto mt-6 flex max-w-xl items-center justify-end gap-2">
        <Markdown content={data.success_markdown} justify size="base" />
      </div>

      <div className="mx-auto mt-6 flex max-w-xl items-center justify-end gap-2">
        <Link to={`/events/${slug || ""}`}>
          <Button variant="outline">بازگشت به رویداد</Button>
        </Link>
        <Link to="/events">
          <Button>مشاهده سایر رویدادها</Button>
        </Link>
      </div>
    </div>
  );
}

function faStatus(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "CONFIRMED":
    case "APPROVED":
      return "تأیید شده";
    case "PENDING":
      return "در انتظار";
    case "CANCELLED":
    case "CANCELED":
      return "لغو شده";
    default:
      return status || "—";
  }
}
