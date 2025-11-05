import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Logout() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await logout();
        if (!alive) return;
        toast({ title: "با موفقیت خارج شدید", variant: "destructive" });
      } catch (e) {
        // even if it fails, we still route to /auth
      } finally {
        if (alive) navigate("/auth", { replace: true });
      }
    })();
    return () => { alive = false; };
  }, [logout, navigate, toast]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-muted-foreground" dir="rtl">
      <Loader2 className="h-6 w-6 animate-spin" />
      <div>در حال خروج از حساب کاربری...</div>
    </div>
  );
}
