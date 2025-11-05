/**
 * Home page highlighting the association mission, key offerings, and primary calls to action.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const heroTitle = "انجمن علمی کامپیوتر دانشگاه گیلان";
const heroDescription =
  "با ما همراه شوید و در دنیای علوم کامپیوتر و فناوری پیشرفت کنید. رویدادها، محتوای آموزشی و جامعه‌ای پویا برای رشد شما فراهم است.";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: heroTitle,
  url: "https://frontend-host-domain.example",
  sameAs: ["https://frontend-host-domain.example/blog", "https://frontend-host-domain.example/events"],
  description: heroDescription,
  logo: "https://frontend-host-domain.example/favicon.ico",
  contactPoint: {
    "@type": "ContactPoint",
    email: "info@frontend-host-domain.example",
    contactType: "customer support",
    availableLanguage: ["fa", "en"]
  }
};

export default function Home() {
  return (
    <>
      <Helmet>
        <title>{heroTitle}</title>
        <meta name="description" content={heroDescription} />
        <meta property="og:title" content={heroTitle} />
        <meta property="og:description" content={heroDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://frontend-host-domain.example" />
        <meta property="og:image" content="https://frontend-host-domain.example/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={heroTitle} />
        <meta name="twitter:description" content={heroDescription} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <main className="min-h-screen bg-background" dir="rtl">
        <header className="bg-gradient-to-b from-primary/10 to-background py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="mb-6 text-4xl font-extrabold leading-tight text-primary sm:text-5xl">{heroTitle}</h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">{heroDescription}</p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/events">
                <Button size="lg" aria-label="مشاهده رویدادهای انجمن">
                  مشاهده رویدادها
                </Button>
              </Link>
              <Link to="/blog">
                <Button size="lg" variant="outline" aria-label="مطالعه مقالات آموزشی">
                  خواندن مقالات
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <section className="py-16" aria-labelledby="about-section">
          <div className="container mx-auto px-4">
            <h2 id="about-section" className="mb-12 text-center text-3xl font-bold">
              درباره انجمن
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>رویدادهای تخصصی</CardTitle>
                  <CardDescription>برگزاری کارگاه‌ها، سمینارها و نشست‌های علمی</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    با شرکت در رویدادهای ما، دانش و مهارت‌های خود را در کنار اساتید و متخصصان ارتقا دهید.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>مقالات آموزشی</CardTitle>
                  <CardDescription>دسترسی به مطالب آموزشی و پژوهشی باکیفیت</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    تازه‌ترین مقالات تخصصی در حوزه‌های مختلف علوم کامپیوتر برای یادگیری و توسعه فردی.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>جامعه فعال</CardTitle>
                  <CardDescription>ارتباط با دانشجویان و اساتید علاقه‌مند به فناوری</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    به جامعه‌ای پویا بپیوندید و از فرصت‌های همکاری، شبکه‌سازی و رشد شخصی بهره‌مند شوید.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="bg-primary/5 py-16" aria-labelledby="cta-section">
          <div className="container mx-auto px-4 text-center">
            <h2 id="cta-section" className="mb-4 text-3xl font-bold">
              آماده عضویت هستید؟
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              همین حالا به جمع ما بپیوندید و از برنامه‌ها و فرصت‌های یادگیری انجمن علمی کامپیوتر دانشگاه گیلان استفاده کنید.
            </p>
            <Link to="/auth">
              <Button size="lg" aria-label="ثبت نام در انجمن علمی کامپیوتر">
                ثبت‌نام کنید
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
