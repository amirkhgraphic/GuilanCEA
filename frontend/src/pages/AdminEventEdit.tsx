import * as React from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { resolveErrorMessage } from '@/lib/utils';

const statusOptions = [
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'published', label: 'منتشر شده' },
  { value: 'cancelled', label: 'لغو شده' },
  { value: 'completed', label: 'برگزار شده' },
];

const typeOptions = [
  { value: 'online', label: 'آنلاین' },
  { value: 'on_site', label: 'حضوری' },
  { value: 'hybrid', label: 'ترکیبی' },
];

const toInputDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear().toString().padStart(4, '0')}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}T${d
    .getHours()
    .toString()
    .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function AdminEventEdit() {
  const { user, isAuthenticated, loading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = Number(id);
  const { toast } = useToast();

  const detailQuery = useQuery({
    queryKey: ['admin', 'edit-event', eventId],
    queryFn: () => api.getEventAdminDetail(eventId),
    enabled: Boolean(eventId) && isAuthenticated,
  });

  const [formData, setFormData] = React.useState({
    title: '',
    status: 'draft',
    event_type: 'online',
    price: '',
    capacity: '',
    start_time: '',
    end_time: '',
    registration_start_date: '',
    registration_end_date: '',
    location: '',
    address: '',
    online_link: '',
    description: '',
  });

  React.useEffect(() => {
    if (detailQuery.data) {
      const d = detailQuery.data as any;
      setFormData({
        title: d.title || '',
        status: d.status || 'draft',
        event_type: d.event_type || 'online',
        price: d.price ? Math.floor(Number(d.price) / 10).toString() : '',
        capacity: d.capacity != null ? String(d.capacity) : '',
        start_time: toInputDateTime(d.start_time),
        end_time: toInputDateTime(d.end_time),
        registration_start_date: toInputDateTime(d.registration_start_date),
        registration_end_date: toInputDateTime(d.registration_end_date),
        location: d.location || '',
        address: d.address || '',
        online_link: d.online_link || '',
        description: d.description || '',
      });
    }
  }, [detailQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.updateEvent(eventId, payload),
    onSuccess: () => {
      toast({ title: 'رویداد به‌روزرسانی شد', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'edit-event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      navigate(`/admin/events/${eventId}`);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'خطا در ذخیره‌سازی رویداد',
        description: resolveErrorMessage(error),
      });
    },
  });

  React.useEffect(() => {
    if (detailQuery.error) {
      toast({
        variant: 'destructive',
        title: 'خطا در دریافت رویداد',
        description: resolveErrorMessage(detailQuery.error),
      });
    }
  }, [detailQuery.error, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">در حال بررسی دسترسی...</p>
      </div>
    );
  }

  if (!isAuthenticated || !(user?.is_staff || user?.is_superuser)) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>ویرایش رویداد</CardTitle>
            <CardDescription>فرم کامل برای ویرایش جزئیات رویداد</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">در حال بارگذاری جزئیات...</p>
            ) : detailQuery.data ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateMutation.mutate({
                    title: formData.title,
                    status: formData.status,
                    event_type: formData.event_type,
                    price: formData.price ? Number(formData.price) * 10 : 0,
                    capacity: formData.capacity ? Number(formData.capacity) : null,
                    start_time: formData.start_time || null,
                    end_time: formData.end_time || null,
                    registration_start_date: formData.registration_start_date || null,
                    registration_end_date: formData.registration_end_date || null,
                    location: formData.location || null,
                    address: formData.address || null,
                    online_link: formData.online_link || null,
                    description: formData.description || '',
                  });
                }}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="عنوان رویداد"
                    value={formData.title}
                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                    required
                  />
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData((p) => ({ ...p, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="وضعیت" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.event_type}
                    onValueChange={(value) => setFormData((p) => ({ ...p, event_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="نوع رویداد" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="قیمت (تومان)"
                    value={formData.price}
                    onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                  />
                  <Input
                    placeholder="ظرفیت"
                    value={formData.capacity}
                    onChange={(e) => setFormData((p) => ({ ...p, capacity: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    placeholder="تاریخ شروع"
                    value={formData.start_time}
                    onChange={(e) => setFormData((p) => ({ ...p, start_time: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    placeholder="تاریخ پایان"
                    value={formData.end_time}
                    onChange={(e) => setFormData((p) => ({ ...p, end_time: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    placeholder="شروع ثبت‌نام"
                    value={formData.registration_start_date}
                    onChange={(e) => setFormData((p) => ({ ...p, registration_start_date: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    placeholder="پایان ثبت‌نام"
                    value={formData.registration_end_date}
                    onChange={(e) => setFormData((p) => ({ ...p, registration_end_date: e.target.value }))}
                  />
                  <Input
                    placeholder="محل برگزاری"
                    value={formData.location}
                    onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                  />
                  <Input
                    placeholder="آدرس دقیق"
                    value={formData.address}
                    onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  />
                  <Input
                    placeholder="لینک آنلاین"
                    value={formData.online_link}
                    onChange={(e) => setFormData((p) => ({ ...p, online_link: e.target.value }))}
                  />
                </div>
                <Textarea
                  placeholder="توضیحات رویداد"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={8}
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                    بازگشت
                  </Button>
                  <Button type="submit" disabled={updateMutation.isLoading}>
                    ذخیره
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-destructive">امکان دریافت رویداد وجود ندارد.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
