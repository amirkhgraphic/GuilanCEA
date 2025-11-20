import { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, ChevronDown, Home, Newspaper, CalendarClock, LayoutDashboard, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import ModeToggle from '@/components/ModeToggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    onClick={onClick}
    className={({ isActive }) =>
      [
        'px-2 py-1 rounded-md transition-colors inline-flex items-center gap-2',
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

  const avatarInitials = useMemo(
    () => (user?.first_name?.[0] || user?.last_name?.[0] || user?.username?.[0] || '?').toUpperCase(),
    [user?.first_name, user?.last_name, user?.username],
  );

  const UserDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-2 py-1 pr-2.5 transition hover:bg-muted"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profile_picture || undefined} alt={user?.username || 'profile'} />
            <AvatarFallback>{avatarInitials}</AvatarFallback>
          </Avatar>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" dir="rtl">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {user?.first_name || user?.last_name ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim() : user?.username}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">پروفایل</Link>
        </DropdownMenuItem>
        {isAdminUser && (
          <DropdownMenuItem asChild>
            <Link to="/admin">داشبورد مدیریت</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="flex items-center justify-between gap-2"
        >
          <span>حالت نمایش</span>
          <ModeToggle />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            navigate('/logout');
          }}
          className="text-red-600 focus:text-red-600"
        >
          خروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60" dir="rtl">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-row-reverse items-center justify-between gap-3">
          <Link to="/" className="order-2 flex items-center gap-2">
            <span className="sm:inline text-2xl font-bold text-primary">
              انجمن علمی کامپیوتر گیلان
            </span>
          </Link>

          <div className="order-1 hidden md:flex items-center gap-2">
            <NavItem to="/"><Home className="h-4 w-4" />خانه</NavItem>
            <NavItem to="/blog"><Newspaper className="h-4 w-4" />بلاگ</NavItem>
            <NavItem to="/events"><CalendarClock className="h-4 w-4" />رویدادها</NavItem>
            {isAuthenticated && isAdminUser && (
              <NavItem to="/admin"><LayoutDashboard className="h-4 w-4" />داشبورد مدیریت</NavItem>
            )}
            {isAuthenticated ? (
              <UserDropdown />
            ) : (
              <>
                <Link to="/auth">
                  <Button size="sm">ورود / ثبت‌نام</Button>
                </Link>
                <ModeToggle />
              </>
            )}
          </div>

          <div className="order-1 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="U.U+U^">
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
                    <NavItem to="/"        onClick={() => setOpen(false)}><Home className="h-4 w-4" />خانه</NavItem>
                    <NavItem to="/blog"    onClick={() => setOpen(false)}><Newspaper className="h-4 w-4" />بلاگ</NavItem>
                    <NavItem to="/events"  onClick={() => setOpen(false)}><CalendarClock className="h-4 w-4" />رویدادها</NavItem>
                    {isAuthenticated && isAdminUser && (
                      <NavItem to="/admin" onClick={() => setOpen(false)}><LayoutDashboard className="h-4 w-4" />داشبورد مدیریت</NavItem>
                    )}
                  </div>

                  <div className="pt-4 border-t grid gap-3">
                    {isAuthenticated ? (
                      <>
                        <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                          <Link to="/profile" onClick={() => setOpen(false)} className="shrink-0">
                            <Avatar className="h-12 w-12 border">
                              <AvatarImage src={user?.profile_picture || undefined} alt={user?.username || 'profile'} />
                              <AvatarFallback>{avatarInitials}</AvatarFallback>
                            </Avatar>
                          </Link>
                          <div className="flex-1 text-right">
                            <div className="font-medium">{user?.username}</div>
                            {user?.email ? <div className="text-xs text-muted-foreground">{user.email}</div> : null}
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-sm text-muted-foreground">حالت نمایش</span>
                            <ModeToggle />
                          </div>
                          <Button
                            variant="outline"
                            className="justify-between text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-950/30"
                            onClick={() => { setOpen(false); navigate('/logout'); }}
                          >
                            خروج
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="grid gap-2">
                        <Link to="/auth" onClick={() => setOpen(false)}>
                          <Button className="w-full"><LogIn className="h-4 w-4" />ورود / ثبت‌نام</Button>
                        </Link>
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                          <span className="text-sm text-muted-foreground">حالت نمایش</span>
                          <ModeToggle />
                        </div>
                      </div>
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
