import * as React from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { resolveErrorMessage } from '@/lib/utils';

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
            <CardDescription>
              این صفحه هنوز در حال طراحی بخش ویرایش رویدادها است، اما می‌توانید خلاصه رویداد را ببینید.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">در حال بارگذاری جزئیات...</p>
            ) : detailQuery.data ? (
              <div className="space-y-2">
                <div className="text-lg font-semibold">{detailQuery.data.title}</div>
                <div className="text-sm text-muted-foreground">
                  این رویداد در وضعیت <strong>{detailQuery.data.status}</strong> قرار دارد.
                </div>
                <div className="text-sm" style={{ lineHeight: 1.6 }}>
                  {detailQuery.data.description.slice(0, 400)}...
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => navigate('/admin')} variant="outline">
                    بازگشت به پنل
                  </Button>
                  <Button disabled>در آینده: فرم ویرایش</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-destructive">امکان دریافت رویداد وجود ندارد.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
