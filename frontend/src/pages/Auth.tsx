import { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SearchableCombobox from '@/components/SearchableCombobox'
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

type RegisterErrors = {
  email?: string;
  username?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  university?: string;
};

const MIN_PASSWORD_LENGTH = 8; // ← در صورت نیاز تغییر بده
const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,30}$/; // ← کاراکترهای مجاز + حداقل 3 کاراکتر
const DISALLOW_PERSIAN_OR_SPACE = /[\u0600-\u06FF\s]/g; // ← حروف فارسی + فاصله

const sanitizeUsername = (v: string) => v.replace(/[^A-Za-z0-9._-]/g, '');
const sanitizeNoFaNoSpace = (v: string) => v.replace(DISALLOW_PERSIAN_OR_SPACE, '');

const isValidEmailBasic = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const initialLogin = { email: '', password: '' };
  const initialRegister = {
    email: '',
    password: '',
    username: '',
    first_name: '',
    last_name: '',
    student_id: '',
    year_of_study: '',
    major: null as string | null,
    university: null as string | null,
  };

  const [loginData, setLoginData] = useState(initialLogin);
  const [registerData, setRegisterData] = useState(initialRegister);
  const [regErrors, setRegErrors] = useState<RegisterErrors>({});
  const [tab, setTab] = useState<'login' | 'register'>('login');

  const siteUrl = 'https://east-guilan-ce.ir';
  const siteName = 'انجمن علمی کامپیوتر شرق دانشگاه گیلان';
  const canonicalUrl = `${siteUrl}/auth`;
  const ogImage = `${siteUrl}/favicon.ico`;
  const metaRobots = 'noindex, nofollow';

  const { pageTitle, pageDescription } = useMemo(() => {
    const variant = tab === 'register' ? 'ثبت‌نام' : 'ورود';
    const description =
      tab === 'register'
        ? 'برای پیوستن به رویدادها، کارگاه‌ها و برنامه‌های انجمن علمی کامپیوتر شرق گیلان حساب کاربری بسازید.'
        : 'برای مدیریت پروفایل و ثبت‌نام‌ رویدادها وارد انجمن علمی کامپیوتر شرق گیلان شوید.';
    return {
      pageTitle: `${variant} | ${siteName}`,
      pageDescription: description,
    };
  }, [tab, siteName]);

  const { data: majors, isLoading: majorsLoading } = useQuery({
    queryKey: ['majors'],
    queryFn: () => api.getMajors(), // expects [{ code, label }]
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  const { data: universities, isLoading: universitiesLoading } = useQuery({
    queryKey: ['universities'],
    queryFn: () => api.getUniversities(), // expects [{ code, label }]
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

    const majorItems = useMemo(
    () => (majors ?? []).map((m: any) => ({ value: String(m.code), label: m.label })),
    [majors]
  );
  const universityItems = useMemo(
    () => (universities ?? []).map((u: any) => ({ value: String(u.code), label: u.label })),
    [universities]
  );

  // تبدیل ارقام فارسی/عربی به انگلیسی و حذف هرچیز غیر 0-9
  const toEnglishDigits = (v: string) =>
    v
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0)) // Persian ۰-۹
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)); // Arabic ٠-٩

  const onlyAsciiDigits = (v: string) => toEnglishDigits(v).replace(/[^0-9]/g, '');

  const handleResendVerification = async () => {
    const email = sanitizeNoFaNoSpace(loginData.email.trim());
    if (!email) {
      toast({
        title: 'ایمیل لازم است',
        description: 'برای ارسال لینک تأیید، ابتدا ایمیل را وارد کنید.',
        variant: 'destructive',
      });
      return;
    }
    if (!isValidEmailBasic(email)) {
      toast({ title: 'ایمیل نامعتبر', description: 'فرمت ایمیل درست نیست.', variant: 'destructive' });
      return;
    }
    try {
      setResendLoading(true);
      await api.resendVerification(email);
      toast({
        title: 'ایمیل ارسال شد',
        description: 'اگر در صندوق ورودی نیست، پوشهٔ هرزنامه (اسپم) را بررسی کنید.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'خطا در ارسال',
        description: e?.message || 'مشکلی رخ داد',
        variant: 'destructive',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = sanitizeNoFaNoSpace(loginData.email.trim());
      const password = sanitizeNoFaNoSpace(loginData.password);
      if (!email || !isValidEmailBasic(email)) {
        throw new Error('ایمیل نامعتبر است.');
      }
      if (!password || DISALLOW_PERSIAN_OR_SPACE.test(loginData.password)) {
        throw new Error('رمز عبور نباید شامل فاصله یا حروف فارسی باشد.');
      }
      await login(email, password);
      toast({ title: 'خوش آمدید', description: 'با موفقیت وارد شدید', variant: 'success' });
      navigate('/');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isUnverified =
        /please verify your email/i.test(msg) ||                 // EN
        /ایمیل.*تایید نشده|لطفاً.*ایمیل.*را.*تأیید/i.test(msg);  // FA

      if (isUnverified) {
        setUnverified(true);
        toast({
          title: 'ایمیل شما تأیید نشده است',
          description: 'برای ورود باید ایمیل را تأیید کنید. می‌توانید لینک تأیید را دوباره ارسال کنید.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'خطا', description: msg || 'خطا در ورود', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const validateRegister = () => {
    const errs: RegisterErrors = {};
    const isBlank = (s: string) => !s || !s.trim();

    const email = sanitizeNoFaNoSpace(registerData.email.trim());
    const username = registerData.username.trim();
    const password = registerData.password;

    if (isBlank(email)) errs.email = 'ایمیل را وارد کنید';
    else if (!isValidEmailBasic(email)) errs.email = 'فرمت ایمیل نامعتبر است';
    else if (DISALLOW_PERSIAN_OR_SPACE.test(registerData.email)) errs.email = 'ایمیل نباید شامل فاصله یا حروف فارسی باشد';

    if (isBlank(username)) errs.username = 'نام کاربری را وارد کنید';
    else if (!USERNAME_REGEX.test(username)) errs.username = 'فقط حروف لاتین، اعداد، نقطه، آندرلاین و خط تیره (حداقل ۳ کاراکتر)';

    if (isBlank(password)) errs.password = 'رمز عبور را وارد کنید';
    else if (password.length < MIN_PASSWORD_LENGTH) errs.password = `حداقل ${MIN_PASSWORD_LENGTH} کاراکتر`;
    else if (DISALLOW_PERSIAN_OR_SPACE.test(password)) errs.password = 'رمز عبور نباید شامل فاصله یا حروف فارسی باشد';

    if (isBlank(registerData.first_name)) errs.first_name = 'نام را وارد کنید';
    if (isBlank(registerData.last_name)) errs.last_name = 'نام خانوادگی را وارد کنید';
    if (!registerData.university) errs.university = 'دانشگاه را انتخاب کنید';

    setRegErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegister()) {
      toast({ title: 'اطلاعات ناقص/نامعتبر', description: 'فیلدهای اجباری را درست تکمیل کنید.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await api.register({
        email: sanitizeNoFaNoSpace(registerData.email.trim()),
        username: registerData.username.trim(),
        password: registerData.password, // سرور هم اعتبارسنجی کند
        first_name: registerData.first_name.trim(),
        last_name: registerData.last_name.trim(),
        student_id: registerData.student_id?.trim() || null,
        year_of_study: registerData.year_of_study ? parseInt(registerData.year_of_study, 10) : null,
        major: registerData.major || null,
        university: registerData.university || null,
      });
      toast({
        title: 'ثبت‌نام موفق',
        description: 'ثبت‌نام با موفقیت انجام شد. لطفاً ایمیل خود را تأیید کنید.',
        variant: 'success',
      });
      setTab('login');
      setLoginData(() => ({ ...initialLogin, email: registerData.email }));
      setRegisterData(initialRegister);
    } catch (error) {
      toast({
        title: 'خطا',
        description: error instanceof Error ? error.message : 'خطا در ثبت‌نام',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const invalidClass = 'border-destructive focus-visible:ring-destructive';

  // فقط اعداد برای سال ورودی
  const onYearChange = (v: string) => v.replace(/\D/g, '');

  useEffect(() => {
    setTab('login');
  }, []);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content={metaRobots} />
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader dir="rtl">
          <CardTitle>انجمن علمی کامپیوتر گیلان</CardTitle>
          <CardDescription>ورود یا ثبت‌نام در سیستم</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')} dir="rtl">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">ورود</TabsTrigger>
              <TabsTrigger value="register">ثبت‌نام</TabsTrigger>
            </TabsList>

            {/* ورود */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div>
                  <Label htmlFor="login-email">ایمیل</Label>
                  <Input
                    id="login-email"
                    name="username"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: sanitizeNoFaNoSpace(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">رمز عبور</Label>
                  <Input
                    id="login-password"
                    name="current-password"
                    type="password"
                    autoComplete="current-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: sanitizeNoFaNoSpace(e.target.value) })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'در حال ورود...' : 'ورود'}
                </Button>

                <Link
                  to="/reset-password"
                  className="block text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 text-right"
                >
                  فراموشی رمز عبور؟
                </Link>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleResendVerification}
                  disabled={resendLoading || !loginData.email}
                  className="min-w-40"
                >
                  {resendLoading ? 'در حال ارسال...' : 'ارسال مجدد ایمیل تأیید'}
                </Button>

                {unverified && (
                  <div className="mt-3 text-right space-y-2">
                    <p className="text-sm text-muted-foreground">
                      حساب شما هنوز تأیید نشده است. لطفاً پوشه‌ی اسپم ایمیل خود را بررسی کنید یا لینک تأیید را دوباره دریافت کنید.
                    </p>
                  </div>
                )}
              </form>
            </TabsContent>

            {/* ثبت‌نام */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4" noValidate>
                <div>
                  <Label htmlFor="register-email">ایمیل</Label>
                  <Input
                    id="register-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={registerData.email}
                    onChange={(e) => {
                      const val = sanitizeNoFaNoSpace(e.target.value);
                      setRegisterData({ ...registerData, email: val });
                      if (regErrors.email) setRegErrors((p) => ({ ...p, email: undefined }));
                    }}
                    className={regErrors.email ? invalidClass : undefined}
                    aria-invalid={!!regErrors.email}
                  />
                  {regErrors.email && <p className="mt-1 text-xs text-destructive">{regErrors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="register-username">نام کاربری</Label>
                  <Input
                    id="register-username"
                    type="text"
                    inputMode="text"
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="فقط حروف لاتین، اعداد، . _ -"
                    value={registerData.username}
                    onChange={(e) => {
                      const val = sanitizeUsername(e.target.value);
                      setRegisterData({ ...registerData, username: val });
                      if (regErrors.username) setRegErrors((p) => ({ ...p, username: undefined }));
                    }}
                    pattern="[A-Za-z0-9._-]{3,30}"
                    className={regErrors.username ? invalidClass : undefined}
                    aria-invalid={!!regErrors.username}
                  />
                  {regErrors.username && <p className="mt-1 text-xs text-destructive">{regErrors.username}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="register-first-name">نام</Label>
                    <Input
                      id="register-first-name"
                      type="text"
                      autoComplete="given-name"
                      value={registerData.first_name}
                      onChange={(e) => {
                        setRegisterData({ ...registerData, first_name: e.target.value });
                        if (regErrors.first_name) setRegErrors((p) => ({ ...p, first_name: undefined }));
                      }}
                      className={regErrors.first_name ? invalidClass : undefined}
                      aria-invalid={!!regErrors.first_name}
                    />
                    {regErrors.first_name && <p className="mt-1 text-xs text-destructive">{regErrors.first_name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="register-last-name">نام خانوادگی</Label>
                    <Input
                      id="register-last-name"
                      type="text"
                      autoComplete="family-name"
                      value={registerData.last_name}
                      onChange={(e) => {
                        setRegisterData({ ...registerData, last_name: e.target.value });
                        if (regErrors.last_name) setRegErrors((p) => ({ ...p, last_name: undefined }));
                      }}
                      className={regErrors.last_name ? invalidClass : undefined}
                      aria-invalid={!!regErrors.last_name}
                    />
                    {regErrors.last_name && <p className="mt-1 text-xs text-destructive">{regErrors.last_name}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-university">دانشگاه</Label>
                  {universitiesLoading ? (
                    <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                  ) : (
                    <>
                      <SearchableCombobox
                        items={universityItems}
                        value={registerData.university}
                        onChange={(v) => {
                          setRegisterData({ ...registerData, university: v });
                          if (regErrors.university) setRegErrors((p) => ({ ...p, university: undefined }));
                        }}
                        placeholder="انتخاب دانشگاه"
                        searchPlaceholder="نام دانشگاه را بنویسید…"
                        emptyText="دانشگاهی پیدا نشد"
                        className={regErrors.university ? "border-destructive focus-visible:ring-destructive" : undefined}
                        dir="rtl"
                      />
                      {regErrors.university && (
                        <p className="mt-1 text-xs text-destructive">{regErrors.university}</p>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <Label htmlFor="register-student-id">شماره دانشجویی (اختیاری)</Label>
                  <Input
                    id="register-student-id"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    dir="ltr"
                    value={registerData.student_id}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, student_id: onlyAsciiDigits(e.target.value) })
                    }
                    onKeyDown={(e) => {
                      const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
                      if (/^[0-9]$/.test(e.key)) return;                 // فقط 0-9
                      if (allowed.includes(e.key)) return;               // کلیدهای کنترلی
                      if ((e.ctrlKey || e.metaKey) && ['a','c','v','x'].includes(e.key.toLowerCase())) return; // میانبرها
                      e.preventDefault(); // بقیه ممنوع
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="register-year">سال ورودی (اختیاری)</Label>
                    <Input
                      id="register-year"
                      type="text"
                      inputMode="numeric"
                      value={registerData.year_of_study}
                      onChange={(e) => setRegisterData({ ...registerData, year_of_study: onYearChange(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="register-major">رشتهٔ تحصیلی (اختیاری)</Label>
                    {majorsLoading ? (
                      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                    ) : (
                      <SearchableCombobox
                        items={majorItems}
                        value={registerData.major}
                        onChange={(v) => setRegisterData({ ...registerData, major: v })}
                        placeholder="انتخاب رشته"
                        searchPlaceholder="نام رشته را بنویسید…"
                        emptyText="رشته‌ای پیدا نشد"
                        dir="rtl"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-password">رمز عبور</Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={registerData.password}
                    onChange={(e) => {
                      const val = sanitizeNoFaNoSpace(e.target.value);
                      setRegisterData({ ...registerData, password: val });
                      if (regErrors.password) setRegErrors((p) => ({ ...p, password: undefined }));
                    }}
                    className={regErrors.password ? invalidClass : undefined}
                    aria-invalid={!!regErrors.password}
                  />
                  {regErrors.password ? (
                    <p className="mt-1 text-xs text-destructive">{regErrors.password}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      حداقل {MIN_PASSWORD_LENGTH} کاراکتر — بدون فاصله و حروف فارسی
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </>
  );
}
