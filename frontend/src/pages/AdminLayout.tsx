import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { to: '/admin/users', label: 'مدیریت کاربران' },
  { to: '/admin/events', label: 'مدیریت رویدادها' },
] as const;

export default function AdminLayout() {
  const location = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const isAdmin = useMemo(
    () => isAuthenticated && Boolean(user?.is_staff || user?.is_superuser),
    [isAuthenticated, user?.is_staff, user?.is_superuser],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground" dir="rtl">
        در حال بارگذاری...
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="border-b bg-muted/20">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 gap-4 flex-row-reverse md:flex-row">
          <h1 className="text-2xl font-bold">پنل مدیریت</h1>
          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded-full px-4 py-2 text-sm transition',
                    (isActive || location.pathname.startsWith(item.to))
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'bg-card text-muted-foreground hover:text-foreground border',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
