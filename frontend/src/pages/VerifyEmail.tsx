import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Info, XCircle } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "already"; message: string }
  | { kind: "error"; message: string };

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>();

  const query = useQuery({
    queryKey: ["verify-email", token],
    queryFn: async (): Promise<State> => {
      if (!token) throw new Error("توکن تأیید یافت نشد.");
      try {
        const res = await api.verifyEmail(token);
        return { kind: "success", message: "ایمیل شما با موفقیت تأیید شد." };
      } catch (e: any) {
        const msg: string = (e?.message || "").toLowerCase();
        if (msg.includes("already verified")) {
          return { kind: "already", message: "ایمیل شما قبلاً تأیید شده است." };
        }
        if (msg.includes("invalid verification token")) {
          return { kind: "error", message: "توکن تأیید نامعتبر است." };
        }
        return {
          kind: "error",
          message: "متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.",
        };
      }
    },
    retry: false,
  });

  useEffect(() => {
    document.title = "تأیید ایمیل";
  }, []);

  const renderBody = () => {
    if (query.isLoading || query.data?.kind === "loading") {
      return (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>در حال تأیید ایمیل...</span>
        </div>
      );
    }

    if (query.isError || query.data?.kind === "error") {
      const message =
        (query.data && "message" in query.data && query.data.message) ||
        "خطای ناشناخته رخ داد";
      return (
        <Alert variant="destructive" dir="rtl" className="text-right">
          <XCircle className="h-5 w-5" />
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      );
    }

    if (query.data?.kind === "already") {
      return (
        <Alert dir="rtl" className="text-right">
          <Info className="h-5 w-5" />
          <AlertTitle>توجه</AlertTitle>
          <AlertDescription>{query.data.message}</AlertDescription>
        </Alert>
      );
    }

    // success
    return (
      <Alert dir="rtl" className="text-right">
        <CheckCircle2 className="h-5 w-5" />
        <AlertTitle>تبریک!</AlertTitle>
        <AlertDescription>ایمیل شما با موفقیت تأیید شد.</AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg" dir="rtl">
        <CardHeader className="text-right">
          <CardTitle>تأیید ایمیل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">{renderBody()}</CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          <Button asChild variant="secondary" className="min-w-32">
            <Link to="/">رفتن به صفحهٔ اصلی</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button asChild className="min-w-32">
              <Link to="/auth">ورود به حساب</Link>
            </Button>
            <Button asChild variant="outline" className="min-w-32">
              <Link to="/profile">پروفایل</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
