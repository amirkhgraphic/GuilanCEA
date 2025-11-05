import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RawVerifyResult = {
  discount_amount: number;
  final_price: number;
};

type Normalized = {
  valid: boolean;
  discount_amount: number;
  final_price: number;
  message_fa: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  basePrice: number; // مبلغ اولیه رویداد
  onVerifyCouponRaw: (code: string) => Promise<RawVerifyResult>;
  onContinue: (coupon?: string, finalPrice?: number) => void; // ادامه‌ی جریان ثبت‌نام/پرداخت
};

export default function CouponDialogFa({
  open,
  onOpenChange,
  basePrice,
  onVerifyCouponRaw,
  onContinue,
}: Props) {
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [res, setRes] = React.useState<Normalized | null>(null);

  // اگر نتیجه نداریم، قیمت نهایی = قیمت پایه
  const finalPrice = res?.final_price ?? basePrice / 10;

  const handleVerify = async () => {
    if (!code) return;
    try {
      setVerifying(true);

      // فراخوانی تابع خام که فقط خروجی بک‌اند را می‌دهد
      const raw = await onVerifyCouponRaw(code);

      // --- نرمالایز داخل همین کامپوننت ---
      setRes({
        valid: true,
        discount_amount: (raw.discount_amount ?? 0) / 10,
        final_price: (raw.final_price ?? basePrice) / 10,
        message_fa: "کد تخفیف با موفقیت اعمال شد",
      });
    } catch (e: any) {
      // تلاش برای گرفتن پیام فارسی از پاسخ خطا (Django Ninja معمولاً در detail می‌گذارد)
      const apiMsg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.data?.detail ||
        e?.message ||
        "کد تخفیف معتبر نیست";

      setRes({
        valid: false,
        discount_amount: 0,
        final_price: basePrice / 10, // برگرداندن قیمت به حالت اولیه
        message_fa: String(apiMsg),
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>کد تخفیف</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 text-right">
          <div className="grid gap-2">
            <Label htmlFor="coupon">کد تخفیف (اختیاری)</Label>
            <div className="flex gap-2">
              <Input
                id="coupon"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثلاً OFF20"
                className="text-right"
              />
              <Button variant="secondary" disabled={!code || verifying} onClick={handleVerify}>
                {verifying ? "در حال بررسی..." : "بررسی کد"}
              </Button>
            </div>

            {/* پیام زیر اینپوت: موفق/نامعتبر */}
            {res && (
              <p className={cn("text-sm", res.valid ? "text-emerald-600" : "text-destructive")}>
                {res.message_fa}
              </p>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">قیمت اولیه</span>
              <span className="font-medium">{(basePrice / 10).toLocaleString("fa-IR")} تومان</span>
            </div>

            {res?.discount_amount ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">تخفیف</span>
                <span className="font-medium">
                  − {res.discount_amount.toLocaleString("fa-IR")} تومان
                </span>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">قیمت نهایی</span>
              <span className="font-semibold">{finalPrice.toLocaleString("fa-IR")} تومان</span>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button
              onClick={() => onContinue(code || undefined, finalPrice)}
              disabled={verifying /* در حال بررسی که هستیم، ادامه غیرفعال باشد */}
            >
              ادامه و پرداخت
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
