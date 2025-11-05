import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ResetPasswordConfirm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({ title: 'توکن نامعتبر است', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'رمز عبور کوتاه است', description: 'حداقل ۸ کاراکتر', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'عدم تطابق', description: 'تکرار رمز با رمز جدید یکسان نیست', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      await api.resetPasswordConfirm(token, password);
      toast({ title: 'رمز عبور با موفقیت تغییر کرد', variant: 'success' });
      navigate('/auth');
    } catch (e: any) {
      toast({ title: 'خطا', description: e?.message || 'مشکلی رخ داد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" dir="rtl">
        <CardHeader>
          <CardTitle>تعیین رمز جدید</CardTitle>
          <CardDescription>رمز عبور جدید را وارد کنید</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">رمز عبور جدید</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="confirm">تکرار رمز</Label>
              <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'در حال ثبت...' : 'ثبت رمز جدید'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
    