import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import ModeToggle from '@/components/ModeToggle';

const NavItem = ({ 
  to,
  children,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
}) => (
  <NavLink
    to={to}
    onClick={onClick}   // ← جدید
    className={({ isActive }) =>
      [
        'px-2 py-1 rounded-md transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      ].join(' ')
    }
  >
    {children}
  </NavLink>
);

export default function Navbar() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isAdminUser = isAuthenticated && ((user?.is_staff || user?.is_superuser) ?? false);
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60" dir="rtl">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* برند */}
          <Link to="/" className="flex items-center gap-2">
            <span className="sm:inline text-2xl font-bold text-primary">
              انجمن علمی کامپیوتر گیلان
            </span>
          </Link>


          <div className="hidden md:flex items-center gap-2">
            <NavItem to="/">خانه</NavItem>
            <NavItem to="/blog">بلاگ</NavItem>
            <NavItem to="/events">رویدادها</NavItem>
            {isAdminUser && <NavItem to="/admin">ادمین</NavItem>}
            {isAuthenticated ? (
              <>
                <NavItem to="/profile">پروفایل</NavItem>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-950/30"
                  onClick={() => navigate('/logout')}
                >
                  خروج
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button size="sm">ورود / ثبت‌نام</Button>
              </Link>
            )}
            <ModeToggle />
          </div>

          {/* همبرگر (فقط موبایل) */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="منو">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[80vw] sm:w-[360px]" dir="rtl">
                <div className="mt-6 flex flex-col gap-4 text-right">
                  <Link
                    to="/"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2"
                  >
                    <img src="/favicon.ico" alt="لوگو" className="h-8 w-auto" height={32} width={32} />
                    <span className="text-xl font-semibold text-primary">انجمن علمی کامپیوتر گیلان</span>
                  </Link>

                  <div className="grid gap-2">
                    <NavItem to="/"        onClick={() => setOpen(false)}>خانه</NavItem>
                    {isAuthenticated && <NavItem to="/profile" onClick={() => setOpen(false)}>پروفایل</NavItem>}
                    <NavItem to="/blog"    onClick={() => setOpen(false)}>بلاگ</NavItem>
                    <NavItem to="/events"  onClick={() => setOpen(false)}>رویدادها</NavItem>
                    {isAdminUser &&
                      <NavItem to="/admin" onClick={() => setOpen(false)}>ادمین</NavItem>}
                  </div>

                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm text-muted-foreground">تغییر تم</span>
                    <ModeToggle />
                  </div>

                  <div className="pt-4 border-t grid gap-2">
                    {isAuthenticated ? (
                      <>
                        <div className="text-sm text-muted-foreground">
                          {user?.username}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-950/30"
                          onClick={() => { setOpen(false); navigate('/logout'); }}
                        >
                          خروج
                        </Button>

                      </>
                    ) : (
                      <Link to="/auth" onClick={() => setOpen(false)}>
                        <Button>ورود / ثبت‌نام</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
