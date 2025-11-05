import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/10 to-background py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">انجمن علمی کامپیوتر دانشگاه گیلان</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            با ما همراه شوید و در دنیای علوم کامپیوتر و فناوری پیشرفت کنید
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/events">
              <Button size="lg">مشاهده رویدادها</Button>
            </Link>
            <Link to="/blog">
              <Button size="lg" variant="outline">خواندن مقالات</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">درباره انجمن</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>رویدادهای تخصصی</CardTitle>
                <CardDescription>
                  برگزاری کارگاه‌ها، سمینارها و رویدادهای علمی
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  با شرکت در رویدادهای ما، دانش و مهارت‌های خود را ارتقا دهید
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مقالات آموزشی</CardTitle>
                <CardDescription>
                  دسترسی به محتوای آموزشی با کیفیت
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  مقالات تخصصی در حوزه‌های مختلف علوم کامپیوتر
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>جامعه فعال</CardTitle>
                <CardDescription>
                  ارتباط با دانشجویان و اساتید
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  عضویت در جامعه‌ای پویا و پرانگیزه از علاقه‌مندان به فناوری
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">آماده عضویت هستید؟</h2>
          <p className="text-muted-foreground mb-8">
            همین حالا به جمع ما بپیوندید و از فرصت‌های یادگیری استفاده کنید
          </p>
          <Link to="/auth">
            <Button size="lg">ثبت‌نام کنید</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
