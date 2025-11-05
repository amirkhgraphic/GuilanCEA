import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ResetPasswordRequest() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.requestPasswordReset(email);
      toast({
        title: 'اگر ایمیلی ثبت شده باشد، لینک بازیابی ارسال شد',
        description: 'ایمیل خود را بررسی کنید.',
        variant: 'success'
      });
    } catch (e: any) {
      // بک‌اند 200 می‌دهد حتی اگر ایمیل نباشد؛ اما اگر اروری بیاید، نشان بده
      toast({ title: 'خطا', description: e?.message || 'مشکلی رخ داد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" dir="rtl">
        <CardHeader>
          <CardTitle>بازیابی رمز عبور</CardTitle>
          <CardDescription>ایمیل‌تان را وارد کنید تا لینک بازیابی برای شما ارسال شود</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">ایمیل</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'در حال ارسال...' : 'ارسال لینک بازیابی'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
