import React from 'react';

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

// ------ داده‌های قابل تنظیم ------
const SITE_URL = 'https://east-guilan-ce.ir';
const SITE_NAME_FA = 'انجمن علمی کامپیوتر شرق گیلان';
const ABOUT_CANONICAL = `${SITE_URL}/about`;
const ABOUT_TITLE = `درباره ما | ${SITE_NAME_FA}`;
const ABOUT_DESCRIPTION =
  'آشنایی با تاریخچه، مأموریت‌ها و دستاوردهای انجمن علمی کامپیوتر شرق گیلان و راه‌های مشارکت دانشجویان در برنامه‌های انجمن.';
const ABOUT_KEYWORDS =
  'انجمن علمی کامپیوتر شرق گیلان, انجمن علمی مهندسی کامپیوتر دانشگاه گیلان، انجمن علمی علوم کامپیوتر، انجمن علمی شرق گیلان، انجمن علمی مهندسی کامپیوتر شرق گیلان، دانشکده فنی و مهندسی شرق گیلان، انجمن علمی کامپیوتر, فعالیت‌های دانشجویی, انجمن‌های علمی ایران, رویدادهای فناوری، برنامه نویسی، انجمن علمی دانشجویی، دانشگاه گیلان، فنی شرق';

const ABOUT_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: ABOUT_TITLE,
  description: ABOUT_DESCRIPTION,
  url: ABOUT_CANONICAL,
  mainEntity: {
    '@type': 'Organization',
    name: SITE_NAME_FA,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
    sameAs: [
      'https://instagram.com/guilance.ir',
      'https://t.me/guilance',
      'https://t.me/guilancea'
    ],
    areaServed: 'IR',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'eastguilanceassociation@gmail.com',
        availableLanguage: ['fa'],
        areaServed: 'IR'
      }
    ]
  }
};

const ORG = {
  title: 'انجمن‌های علمی کامپیوتر گیلان', // تیتر کلی
  subtitle:
    'پیوند دانشگاه و صنعت با برگزاری رویدادها، کارگاه‌ها و نشست‌های تخصصی — با محوریت رشد مهارت‌های فنی و مسیرهای شغلی.',
  foundedYear: '۱۴۰۴',
  membersApprox: '۱۰۰+',
  eventsCount: '۱۰+',
  volunteersCount: '۲۰+',
};

// اگر چند انجمن زیرمجموعه دارید، اینجا معرفی کنید
const ASSOCIATIONS = [
  {
    name: 'انجمن علمی مهندسی کامپیوتر دانشکده‌ی فنی شرق',
    university: 'دانشگاه گیلان',
    city: 'رودسر',
    foundedYear: '۱۳۹۲',
    about:
      'برگزاری رویدادهای آموزشی و صنعتی، منتورینگ دانشجویی، و اتصال دانشجویان به فرصت‌های شغلی و پژوهشی.',
    focusAreas: ['مهندسی نرم‌افزار', 'هوش مصنوعی و داده', 'طراحی محصول', 'DevOps/امنیت'],
    links: {
      website: 'https://east-guilan-ce.ir',
      instagram: '"https://instagram.com/guilance.ir',
      telegram: 'https://t.me/guilance',
      email: 'eastguilanceassociation@gmail.com',
    },
  },
  {
    name: 'انجمن علمی مهندسی کامپیوتر دانشکده‌ی فنی',
    university: 'دانشگاه گیلان',
    city: 'رشت',
    foundedYear: '۱۳۵۳',
    about: 'برگزاری رویدادهای آموزشی و صنعتی، منتورینگ دانشجویی، و اتصال دانشجویان به فرصت‌های شغلی و پژوهشی.',
    focusAreas: ['مهندسی نرم‌افزار', 'هوش مصنوعی و داده', 'DevOps'],
    links: {
      instagram: 'https://instagram.com/ce.guilan',
      telegram: 'https://t.me/CSAOEF',
      email: 'cesa@guilan.ac.ir'
    },
  },
  {
    name: 'انجمن علمی علوم کامپیوتر دانشکده‌ی علوم‌پایه',
    university: 'دانشگاه گیلان',
    city: 'رشت',
    foundedYear: '۱۳۵۳',
    about: 'برگزاری رویدادهای آموزشی و صنعتی، منتورینگ دانشجویی، و اتصال دانشجویان به فرصت‌های شغلی و پژوهشی.',
    focusAreas: ['امنیت', 'سیستم‌عامل', 'سخت‌افزار'],
    links: {
      instagram: 'https://instagram.com/csguilan',
      telegram: 'https://t.me/guilanCS',
    },
  },
];

// کمیته‌ها/گروه‌های کاری
const COMMITTEES = [
  {
    title: 'کمیته آموزش',
    desc: 'برنامه‌ریزی و اجرای دوره‌ها و کارگاه‌های مهارتی، هماهنگی با مدرسین و طراحی مسیرهای یادگیری.'
  },
  {
    title: 'کمیته صنعت و اشتغال',
    desc: 'تعامل با شرکت‌ها، دعوت از متخصصان صنعت، و شبکه‌سازی برای فرصت‌های کارآموزی و استخدام.'
  },
  {
    title: 'کمیته محتوای دیجیتال',
    desc: 'تولید محتوای آموزشی، خبرنامه، مدیریت شبکه‌های اجتماعی و پوشش رسانه‌ای رویدادها.'
  },
];

// راه‌های ارتباطی اصلی صفحه
const CONTACTS = [
  {
    label: 'ایمیل',
    value: 'eastguilanceassociation@gmail.com',
    href: 'mailto:eastguilanceassociation@gmail.com',
  },
  {
    label: 'تلگرام',
    value: '@GuilanCEA',
    href: 'https://t.me/guilancea',
  },
  {
    label: 'اینستاگرام',
    value: '@GuilanCE.ir',
    href: 'https://instagram.com/guilance.ir',
  },
  {
    label: 'وب‌سایت',
    value: 'east-guilan-ce.ir',
    href: 'https://east-guilan-ce.ir',
  },
];

export default function AboutUs() {
  return (
    <>
      <Helmet>
        <title>{ABOUT_TITLE}</title>
        <meta name="description" content={ABOUT_DESCRIPTION} />
        <meta name="keywords" content={ABOUT_KEYWORDS} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={ABOUT_CANONICAL} />
        <meta property="og:title" content={ABOUT_TITLE} />
        <meta property="og:description" content={ABOUT_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={ABOUT_CANONICAL} />
        <meta property="og:site_name" content={SITE_NAME_FA} />
        <meta property="og:image" content={`${SITE_URL}/favicon.ico`} />
        <meta property="og:locale" content="fa_IR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ABOUT_TITLE} />
        <meta name="twitter:description" content={ABOUT_DESCRIPTION} />
        <meta name="twitter:image" content={`${SITE_URL}/favicon.ico`} />
        <script type="application/ld+json">{JSON.stringify(ABOUT_STRUCTURED_DATA)}</script>
      </Helmet>
      <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero */}
      <section className="bg-gradient-to-b from-muted/40 to-transparent">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">{ORG.title}</h1>
          <p className="mt-3 text-muted-foreground leading-7">{ORG.subtitle}</p>

          {/* آمار کوتاه */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="سال تأسیس" value={ORG.foundedYear} />
            <Stat label="اعضا" value={ORG.membersApprox} />
            <Stat label="رویدادها" value={ORG.eventsCount} />
            <Stat label="داوطلبان" value={ORG.volunteersCount} />
          </div>
        </div>
      </section>

      {/* درباره ما */}
      <section className="container mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardHeader title="ماموریت ما" subtitle="چرا اینجا هستیم؟" />
              <div className="p-6 pt-0 text-sm leading-7 text-muted-foreground">
                <p>
                  توانمندسازی دانشجویان با مهارت‌های موردنیاز صنعت، ایجاد شبکه‌های حرفه‌ای و فراهم‌کردن مسیرهای یادگیری
                  پروژه‌محور؛ از معرفی نقش‌ها و مسیرهای شغلی تا تمرین مهارت‌های نرم و فنی.
                </p>
              </div>
            </Card>

            <Card className="mt-6">
              <CardHeader title="ارزش‌های ما" subtitle="چه چیزهایی برای‌مان مهم است؟" />
              <ul className="p-6 pt-0 grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-2">
                <li className="rounded-xl border p-3">یادگیری پیوسته و اشتراک دانش</li>
                <li className="rounded-xl border p-3">کیفیت، شفافیت و مسئولیت‌پذیری</li>
                <li className="rounded-xl border p-3">فرصت برابر برای مشارکت</li>
                <li className="rounded-xl border p-3">ارتباط مؤثر با صنعت و جامعه</li>
              </ul>
            </Card>
          </div>

          {/* تماس سریع */}
          <div>
            <Card>
              <CardHeader title="راه‌های ارتباطی" subtitle="با ما در ارتباط باشید" />
              <div className="p-6 pt-0 space-y-3">
                {CONTACTS.map((c) => (
                  <a
                    key={c.label}
                    href={c.href}
                    target={c.href?.startsWith('http') ? '_blank' : undefined}
                    rel={c.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm text-foreground">{c.label}</span>
                    <span className="text-xs text-muted-foreground ltr:ml-2 rtl:mr-2 truncate">{c.value}</span>
                  </a>
                ))}
              </div>
            </Card>

            <Card className="mt-6">
              <CardHeader title="ساعات پاسخ‌گویی" subtitle="پشتیبانی داوطلبانه" />
              <div className="p-6 pt-0 text-sm text-muted-foreground">
                <p>روزهای شنبه تا چهارشنبه، ساعت ۱۰ تا ۱۸</p>
                <p className="mt-2">پاسخ‌ها توسط تیم داوطلبان انجام می‌شود.</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* انجمن‌ها */}
      <section className="bg-muted/20">
        <div className="container mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-2xl font-bold text-foreground">انجمن‌ها</h2>
          <p className="mt-2 text-sm text-muted-foreground">اطلاعات انجمن‌های زیرمجموعه/همکار</p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {ASSOCIATIONS.map((a) => (
              <Card key={a.name}>
                <div className="p-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{a.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.university}{a.city ? ` • ${a.city}` : ''}{' '}
                        {a.foundedYear && `• تأسیس: ${a.foundedYear}`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{a.about}</p>

                  {a.focusAreas?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {a.focusAreas.map((f) => (
                        <span key={f} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    {a.links?.website && (
                      <a className="rounded-xl border p-3 hover:bg-muted/50" href={a.links.website} target="_blank" rel="noreferrer">وب‌سایت</a>
                    )}
                    {a.links?.instagram && (
                      <a className="rounded-xl border p-3 hover:bg-muted/50" href={a.links.instagram} target="_blank" rel="noreferrer">اینستاگرام</a>
                    )}
                    {a.links?.telegram && (
                      <a className="rounded-xl border p-3 hover:bg-muted/50" href={a.links.telegram} target="_blank" rel="noreferrer">تلگرام</a>
                    )}
                    {a.links?.email && (
                      <a className="rounded-xl border p-3 hover:bg-muted/50" href={`mailto:${a.links.email}`}>ایمیل</a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* کمیته‌ها */}
      <section className="container mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-bold text-foreground">کمیته‌ها و گروه‌های کاری</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {COMMITTEES.map((c) => (
            <Card key={c.title}>
              <div className="p-5">
                <h3 className="text-base font-semibold text-foreground">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-7">{c.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* پرسش‌های متداول */}
      <section className="bg-muted/20">
        <div className="container mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-2xl font-bold text-foreground">پرسش‌های متداول</h2>
          <div className="mt-6 space-y-3">
            <FAQ q="چطور در رویدادها شرکت کنم؟" a="برای ثبت‌نام در رویدادها ابتدا باید حساب‌کاربری با کددانشجویی خود ایجاد کنید و سپس از طریق صفحه‌ی ثبت‌نام در رویداد موردنظرتان شرکت کنید :)" />
            <FAQ q="آیا امکان همکاری انجمن‌ها/شرکت‌ها هم وجود دارد؟" a="بله، ما همیشه آماده‌ی همکاری با سازمان‌ها و انجمن‌های مختلف دانشگاه‌ها جهت توانمندسازی دانشجویان با مهارت‌های موردنیاز صنعت و ایجاد شبکه‌های حرفه‌ای هستیم." />
            <FAQ q="برای سخنرانی/منتورینگ به چه چیزهایی نیاز است؟" a="رزومه کوتاه، موضوع پیشنهادی و زمان‌های دسترس‌پذیرتان را ارسال کنید تا هماهنگ کنیم." />
          </div>
        </div>
      </section>

      {/* نقشه و آدرس اختیاری */}
      <section className="container mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-bold text-foreground">نشانی دانشکده</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <Card>
            <div className="p-5 text-sm text-muted-foreground leading-7">
              <p>آدرس: گیلان، رودسر، واجارگاه، دانشکده‌ی فنی و مهندسی شرق گیلان</p>
              <p>کدپستی: ۴۴۹۱۸۹۸۵۶۶</p>
              <p>تلفن: ۰۱۳-۴۲۶۸۸۴۴۷</p>
              <p className="mt-3">برای هماهنگی حضوری از قبل پیام بدهید.</p>
            </div>
          </Card>
          <div className="rounded-xl border overflow-hidden min-h-[280px] bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
            <iframe
                src="https://maps.google.com/maps?q=37.06285,50.42324&hl=fa&z=16&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full aspect-video border-0"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-t from-muted/40 to-transparent">
        <div className="container mx-auto max-w-6xl px-4 py-12 text-center">
          <h3 className="text-xl md:text-2xl font-bold text-foreground">مایل به همکاری هستید؟</h3>
          <p className="mt-2 text-sm text-muted-foreground">برای مشارکت داوطلبانه، سخنرانی، اسپانسری یا همکاری صنعتی به ما پیام دهید.</p>
          <div className="mt-4 inline-flex gap-3">
            <a href="mailto:eastguilanceassociation@gmail.com" className="rounded-xl border px-5 py-2 text-sm hover:bg-muted/50">ایجاد ارتباط</a>
            <a href="https://t.me/guilancea" target="_blank" rel="noreferrer" className="rounded-xl bg-primary px-5 py-2 text-sm text-primary-foreground">
              پیام در تلگرام
            </a>
          </div>
        </div>
      </section>
      </div>
    </>
  );
}

// --------- اجزای کوچک ---------
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-4 text-center">
      <div className="text-2xl font-extrabold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Card({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`rounded-2xl border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>;
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="p-6 pb-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-xl border bg-background p-4">
      <summary className="cursor-pointer select-none text-sm font-medium text-foreground">{q}</summary>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{a}</p>
    </details>
  );
}
