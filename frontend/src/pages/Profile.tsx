import type * as Types from '@/lib/types';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { formatJalali } from '@/lib/utils';
import Markdown from '@/components/Markdown';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function Profile() {
  const { user, isAuthenticated, loading } = useAuth();
  const { toast } = useToast();

  const {
    data: myRegs,
    isLoading: regsLoading,
    isError: regsError,
  } = useQuery({
    queryKey: ['my-registrations'],
    queryFn: () => api.getMyRegistrations(),
    enabled: isAuthenticated,
  });

  const { data: majors, isLoading: majorsLoading } = useQuery({
    queryKey: ['majors'],
    queryFn: () => api.getMajors(),
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  const { data: universities, isLoading: universitiesLoading } = useQuery({
    queryKey: ['universities'],
    queryFn: () => api.getUniversities(),
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  const [me, setMe] = useState<Types.UserProfileSchema | null>(user as any);
  const [fetching, setFetching] = useState(false);
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState<Types.UserUpdateSchema>({
    first_name: '',
    last_name: '',
    bio: '',
    year_of_study: null,
    major: null,
    university: null,
    student_id: '',
  });

  const loadProfile = async () => {
    try {
      setFetching(true);
      const profile = await api.getProfile();
      setMe(profile);
      setFormData({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        bio: profile.bio ?? '',
        year_of_study: typeof profile.year_of_study === 'number' ? profile.year_of_study : null,
        major: (profile.major as any) ?? null,
        university: (profile.university as any) ?? null,
        student_id: profile.student_id ?? null,
      });

    } catch (e: any) {
      toast({ title: 'خطا در دریافت پروفایل', description: e?.message || 'مشکلی پیش آمد', variant: 'destructive' });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!majors) return;
    if (me?.major) {
      const found = majors.find(m => m.code === me.major || m.label === me.major);
      if (found && formData.major !== found.code) {
        setFormData(prev => ({ ...prev, major: found.code }));
      }
    }
  }, [majors, me?.major]); // eslint-disable-line react-hooks/exhaustive-deps

  const majorLabel = useMemo(() => {
    if (!me?.major) return '—';
    if (majors) {
      const f = majors.find(m => m.code === me.major || m.label === me.major);
      return f.label;
    }
    return me.major;
  }, [majors, me?.major]);
  
  useEffect(() => {
    if (!universities) return;
    if (me?.university) {
      const found = universities.find(u => u.code === me.university || u.label === me.university);
      if (found && formData.university !== found.code) {
        setFormData(prev => ({ ...prev, university: found.code }));
      }
    }
  }, [universities, me?.university]); // eslint-disable-line react-hooks/exhaustive-deps

  const universityLabel = useMemo(() => {
    if (!me?.university) return '—';
    if (universities) {
      const f = universities.find(u => u.code === me.university || u.label === me.university);
      return f.label;
    }
  }, [universities, me?.university]);


  if (!loading && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const kv = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-3 items-center py-2" dir="rtl">
      <div className="text-sm text-muted-foreground text-right">{label}</div>
      <div className="col-span-2 text-sm text-right">{value ?? '—'}</div>
    </div>
  );

  const [uploading, setUploading] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.currentTarget.value = ''; // allow picking the same file again later
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Types.UserUpdateSchema = {
        first_name: formData.first_name ?? '',
        last_name: formData.last_name ?? '',
        bio: formData.bio ?? '',
        year_of_study:
          formData.year_of_study === undefined || formData.year_of_study === null
            ? null
            : Number(formData.year_of_study),
        major: formData.major || null,
        university: formData.university || null,
        student_id: formData.student_id || null,
      };

      const updated = await api.updateProfile(payload);
      setMe(updated);
      setEditing(false);
      toast({ title: 'پروفایل به‌روزرسانی شد', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'خطا در ذخیره پروفایل', description: e?.message || 'مشکلی پیش آمد', variant: 'destructive' });
    }
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onUpload = async (file: File) => {
    try {
      setUploading(true);
      toast({ title: 'در حال آپلود تصویر...' });
      await api.uploadProfilePicture(file); // POST /api/auth/profile/picture
      await loadProfile();
      toast({ title: 'تصویر پروفایل به‌روزرسانی شد', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'خطا در آپلود تصویر', description: e?.message || 'مشکلی پیش آمد', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };


  const onDeletePicture = async () => {
    try {
      await api.deleteProfilePicture();
      await loadProfile();
      toast({ title: 'تصویر پروفایل حذف شد' });
    } catch (e: any) {
      toast({ title: 'خطا در حذف تصویر', description: e?.message || 'مشکلی پیش آمد', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader dir="rtl" className="text-right">
            <div className="flex flex-col gap-4 items-center sm:flex-row">

              <div className="relative shrink-0">
                {/* CLICKABLE AVATAR */}
                <button
                  type="button"
                  onClick={onPickFile}
                  aria-label="تغییر عکس پروفایل"
                  className="
                    group relative h-20 w-20 sm:h-20 sm:w-20 rounded-full overflow-hidden
                    bg-muted flex items-center justify-center
                    ring-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                    cursor-pointer
                  "
                  title="تغییر عکس پروفایل"
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                >
                  {me?.profile_picture ? (
                    <img
                      src={me.profile_picture}
                      alt="avatar"
                      className="h-full w-full object-cover transition-transform group-active:scale-95"
                    />
                  ) : (
                    <span className="text-xl transition-transform group-active:scale-95">
                      {(me?.first_name?.[0] || me?.last_name?.[0] || me?.email?.[0] || '?').toUpperCase()}
                    </span>
                  )}

                  {/* SPINNER OVERLAY DURING UPLOAD */}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                </button>

                {/* FLOATING TRASH ICON (bigger touch target, only if picture exists) */}
                {me?.profile_picture && (
                  <button
                    type="button"
                    onClick={onDeletePicture}
                    aria-label="حذف تصویر پروفایل"
                    className="
                      absolute -bottom-3
                      rounded-full bg-destructive text-destructive-foreground
                      p-2 shadow-lg hover:opacity-95 active:scale-95
                      focus:outline-none focus:ring-2 focus:ring-destructive/70
                    "
                    title="حذف تصویر"
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="min-w-0 text-center sm:text-start">
                <div className="text-xl font-semibold truncate">{me?.first_name || '—'} { me?.last_name }</div>
                <div className="text-sm text-muted-foreground truncate">{me?.email || '—'}</div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
          </CardHeader>


          <CardContent>
            {loading || fetching ? (
              <div className="flex items-center gap-3 text-muted-foreground justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>در حال بارگذاری پروفایل...</span>
              </div>
            ) : !editing ? (
              /* حالت مشاهده */
              <div className="space-y-2" dir="rtl">
                <div className="mb-2">
                  {me?.bio && ( <Markdown content={me.bio} justify /> )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-none shadow-none">
                    <CardHeader className="px-0 pt-0 pb-2">
                      <CardTitle className="text-base text-right">اطلاعات شخصی</CardTitle>
                      <CardDescription className="text-right">مشاهده اطلاعات شما</CardDescription>
                    </CardHeader>
                    <CardContent className="px-0">
                      {kv('نام', me?.first_name || '—')}
                      {kv('نام خانوادگی', me?.last_name || '—')}
                      {kv('شماره دانشجویی', me?.student_id || '—')}
                      {kv('دانشگاه', universityLabel)}
                      {kv('رشته', majorLabel)}
                      {kv('سال ورود', typeof me?.year_of_study === 'number' ? me?.year_of_study : '—')}

                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-none">
                    <CardHeader className="px-0 pt-0 pb-2">
                      <CardTitle className="text-base text-right">اطلاعات حساب</CardTitle>
                      <CardDescription className="text-right">جزئیات مربوط به حساب کاربری</CardDescription>
                    </CardHeader>
                    <CardContent className="px-0">
                      {kv('ایمیل', me?.email || '—')}
                      {kv('نام کاربری', me?.username || '—')}
                      {kv('تاریخ عضویت', formatJalali(me?.date_joined))}
                      {kv('تغییر رمز عبور', <Link to="/reset-password" className="block text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 text-right">ارسال ایمیل فراموشی رمز عبور</Link>)}
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 text-right">
                  <Button onClick={() => setEditing(true)}>ویرایش پروفایل</Button>
                </div>
              </div>
            ) : (
              /* حالت ویرایش: فقط فیلدهای UserUpdateSchema */
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="rtl">
                <div>
                  <Label htmlFor="first_name" className="block text-right">نام</Label>
                  <Input
                    id="first_name"
                    dir="rtl"
                    value={formData.first_name ?? ''}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="last_name" className="block text-right">نام خانوادگی</Label>
                  <Input
                    id="last_name"
                    dir="rtl"
                    value={formData.last_name ?? ''}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="year_of_study" className="block text-right">سال ورود</Label>
                  <Input
                    id="year_of_study"
                    dir="rtl"
                    type="number"
                    inputMode="numeric"
                    value={formData.year_of_study ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        year_of_study: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="university" className="block text-right">دانشگاه</Label>
                  {universitiesLoading ? (
                    <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                  ) : (
                    <Select
                      value={formData.university ?? ''}
                      onValueChange={(v) => setFormData({ ...formData, university: v || null })}
                    >
                      <SelectTrigger id="university" dir="rtl" className="justify-between">
                        <SelectValue placeholder="انتخاب دانشگاه" />
                      </SelectTrigger>
                      <SelectContent dir="rtl" className="max-h-64">
                        {universities?.map((u) => (
                          <SelectItem key={u.code} value={u.code}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor="major" className="block text-right">رشته</Label>

                  {majorsLoading ? (
                    <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                  ) : (
                    <Select
                      value={formData.major ?? ''}
                      onValueChange={(v) => setFormData({ ...formData, major: v || null })}
                    >
                      <SelectTrigger id="major" dir="rtl" className="justify-between">
                        <SelectValue placeholder="انتخاب رشته" />
                      </SelectTrigger>
                      <SelectContent dir="rtl" className="max-h-64">
                        {majors?.map((m) => (
                          <SelectItem key={m.code} value={m.code}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor="student_id" className="block text-right">شماره دانشجویی</Label>
                  <Input
                    id="student_id"
                    dir="rtl"
                    value={formData.student_id ?? ''}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  />
                </div>


                <div className="md:col-span-2">
                  <Label htmlFor="bio" className="block text-right">بیو</Label>
                  <Textarea
                    id="bio"
                    dir="rtl"
                    rows={10}
                    className="resize-y"
                    value={formData.bio ?? ''}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2 flex gap-2 mt-2 justify-end">
                  <Button type="submit">ذخیره</Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    انصراف
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>ثبت‌نام‌های من</CardTitle>
            <CardDescription>رویدادهایی که در آن‌ها ثبت‌نام کرده‌اید</CardDescription>
          </CardHeader>
          <CardContent>
            {regsLoading && <div className="text-sm text-muted-foreground">در حال بارگذاری…</div>}
            {regsError && <div className="text-sm text-red-500">خطا در دریافت ثبت‌نام‌ها</div>}
            {!regsLoading && !regsError && (!myRegs || myRegs.length === 0) && (
              <div className="text-sm text-muted-foreground">هنوز در رویدادی ثبت‌نام نکرده‌اید.</div>
            )}
            {!regsLoading && !regsError && myRegs && myRegs.length > 0 && (
              <div className="space-y-3">
                {myRegs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{r.event.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.status === 'confirmed' ? 'تایید شده' : r.status === 'pending' ? 'در انتظار' : 'لغو شده'}
                        {' • '}
                        {r.event.start_date ? `تاریخ شروع: ${formatJalali(r.event.start_date)}` : ''}
                      </div>
                    </div>
                    <Link to={`/events/${r.event.slug}`} className="text-primary text-sm">مشاهده رویداد</Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
