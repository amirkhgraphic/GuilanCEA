import * as React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Instagram, Send, Twitter, Linkedin } from "lucide-react";
import { api } from "@/lib/api"; // متد subscribeNewsletter را پایین توضیح داده‌ام

export default function Footer() {
  // const { toast } = useToast();
  // const [email, setEmail] = React.useState("");
  // const [loading, setLoading] = React.useState(false);
  const year = new Date().getFullYear();

  // const validateEmail = (v: string) =>
  //   /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  // const onSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   const em = email.trim();
  //   if (!validateEmail(em)) {
  //     toast({ title: "ایمیل نامعتبر است", description: "لطفاً یک ایمیل صحیح وارد کنید.", variant: "destructive" });
  //     return;
  //   }
  //   try {
  //     setLoading(true);
  //     const response = await api.subscribeNewsletter(em);

  //     if (response.success) {
  //       toast({ title: "عضویت موفق", description: response.message });
  //       setEmail("");
  //     } else {
  //       toast({ title: "عضویت ناموفق", description: response.message, variant: "destructive" });
  //     }
      
  //   } catch (err: any) {
  //     toast({ title: "خطا", description: err?.message || "مشکلی رخ داد.", variant: "destructive" });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <footer className="border-t bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40" dir="rtl">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">

          {/* برند + درباره + اینماد */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src="/favicon.ico" alt="لوگوی انجمن" className="h-9 w-9 rounded" />
              <span className="text-xl font-bold">انجمن علمی کامپیوتر گیلان</span>
            </div>
            <p className="text-sm text-muted-foreground leading-7">
              ترویج علم کامپیوتر، برگزاری رویدادهای تخصصی، تقویت شبکهٔ دانشجویی و پیوند با صنعت.
            </p>

          </div>

          {/* لینک‌های سریع */}
          <div>
            <h4 className="mb-3 text-base font-semibold">لینک‌های مفید</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-muted-foreground hover:text-foreground">خانه</Link></li>
              <li><Link to="/events" className="text-muted-foreground hover:text-foreground">رویدادها</Link></li>
              <li><Link to="/blog" className="text-muted-foreground hover:text-foreground">بلاگ</Link></li>
              <li><Link to="/about" className="text-muted-foreground hover:text-foreground">دربارهٔ انجمن</Link></li>
              {/* <li><Link to="/contact" className="text-muted-foreground hover:text-foreground">تماس با ما</Link></li> */}
              {/* <li><Link to="/rules" className="text-muted-foreground hover:text-foreground">قوانین و حریم خصوصی</Link></li> */}
            </ul>
          </div>

          {/* اطلاعات تماس / شبکه‌های اجتماعی */}
          <div>
            <h4 className="mb-3 text-base font-semibold">ارتباط با ما</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>ایمیل: info@east-guilan-ce.ir</li>
              <li>آدرس: دانشگاه گیلان، دانشکده‌ی فنی و مهندسی شرق گیلان</li>
            </ul>

            <div className="mt-4 flex items-center gap-2">
              <a href="https://Instagram.com/guilance.ir" target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="اینستاگرام">
                  <Instagram className="h-4 w-4" />
                </Button>
              </a>
              <a href="https://t.me/guilance" target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="تلگرام">
                  <Send className="h-4 w-4" />
                </Button>
              </a>
              <a href="https://www.linkedin.com/in/amiirkhl/" target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="لینکدین">
                  <Linkedin className="h-4 w-4" />
                </Button>
              </a>
              <a href="https://x.com" target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="ایکس (توییتر)">
                  <Twitter className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>

          {/* خبرنامه */}
          {/* <div>
            <h4 className="mb-3 text-base font-semibold">عضویت در خبرنامه</h4>
            <p className="mb-3 text-sm text-muted-foreground">
              برای اطلاع از رویدادها و اخبار انجمن، ایمیل خود را وارد کنید.
            </p>
            <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                inputMode="email"
                placeholder="ایمیل شما"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sm:flex-1 text-left"
              />
              <Button type="submit" disabled={loading}>
                {loading ? "در حال عضویت..." : "عضویت"}
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              با عضویت، با <Link to="/rules" className="underline underline-offset-4">قوانین و حریم خصوصی</Link> موافقم.
            </p>
          </div> */}
          <div className="justify-self-end">
            <a
              href="https://trustseal.enamad.ir/?id=649977&Code=m0wWM1DFYqd4fLEnjyMU3o2pupfuqDVW"
              target="_blank"
              rel="noreferrer"
              referrerPolicy="origin"
            >
              <img
                src="/enamad.png"
                width="125px"
                alt="نماد اعتماد الکترونیکی"
                referrerPolicy="origin"
                style={{ cursor: "pointer" }}
                data-code="m0wWM1DFYqd4fLEnjyMU3o2pupfuqDVW"
              />
            </a>
          </div>
        </div>

        {/* خط جداکننده */}
        <div className="my-8 h-px w-full bg-border" />

        {/* کپی‌رایت */}
        <div className="flex gap-2 items-center justify-center text-sm text-muted-foreground md:flex-row">
          <div>© {year} انجمن علمی کامپیوتر گیلان — تمامی حقوق محفوظ است.</div>
        </div>
      </div>
    </footer>
  );
}
