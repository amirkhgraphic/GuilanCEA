import * as React from 'react';
import {
  useQuery,
} from '@tanstack/react-query';
import type { UserListSchema } from '@/lib/types';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  formatJalali,
  formatNumberPersian,
  resolveErrorMessage,
} from '@/lib/utils';

const USERS_PAGE_SIZE = 25;

const AdminUsersPage: React.FC = () => {
  const { toast } = useToast();
  const [filters, setFilters] = React.useState({
    search: '',
    studentId: '',
    university: 'all',
    major: 'all',
    isActive: 'all',
  });
  const [page, setPage] = React.useState(1);

  const majorsQuery = useQuery({
    queryKey: ['majors'],
    queryFn: () => api.getMajors(),
  });
  const universitiesQuery = useQuery({
    queryKey: ['universities'],
    queryFn: () => api.getUniversities(),
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', filters, page],
    queryFn: () =>
      api.listUsers({
        search: filters.search || undefined,
        student_id: filters.studentId || undefined,
        university: filters.university === 'all' ? undefined : filters.university,
        major: filters.major === 'all' ? undefined : filters.major,
        is_active:
          filters.isActive === 'all'
            ? undefined
            : filters.isActive === 'active'
            ? 'true'
            : 'false',
        limit: USERS_PAGE_SIZE,
        offset: (page - 1) * USERS_PAGE_SIZE,
      }),
  });

  const users = usersQuery.data ?? [];
  const hasMore = users.length === USERS_PAGE_SIZE;

  React.useEffect(() => {
    if (usersQuery.error) {
      toast({
        title: 'خطا در بارگذاری کاربران',
        description: resolveErrorMessage(usersQuery.error),
        variant: 'destructive',
      });
    }
  }, [usersQuery.error, toast]);

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-semibold">کاربران</h2>
        <p className="text-sm text-muted-foreground mt-1">مدیریت و جستجوی کاربران سامانه</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>فیلترها</CardTitle>
          <CardDescription>جستجو و محدود کردن نتایج</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              placeholder="نام، نام‌کاربری یا ایمیل..."
              value={filters.search}
              onChange={(event) => handleFilterChange('search', event.target.value)}
            />
            <Input
              placeholder="شماره دانشجویی"
              value={filters.studentId}
              onChange={(event) => handleFilterChange('studentId', event.target.value)}
            />
            <Select value={filters.isActive} onValueChange={(value) => handleFilterChange('isActive', value)}>
              <SelectTrigger>
                <SelectValue placeholder="وضعیت">
                  {{
                    all: 'همه وضعیت‌ها',
                    active: 'فعال',
                    inactive: 'غیرفعال',
                  }[filters.isActive]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="inactive">غیرفعال</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              value={filters.university}
              onValueChange={(value) => handleFilterChange('university', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="دانشگاه">
                  {filters.university === 'all'
                    ? 'همه'
                    : universitiesQuery.data?.find((item) => item.code === filters.university)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {universitiesQuery.data?.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.major} onValueChange={(value) => handleFilterChange('major', value)}>
              <SelectTrigger>
                <SelectValue placeholder="رشته">
                  {filters.major === 'all'
                    ? 'همه'
                    : majorsQuery.data?.find((item) => item.code === filters.major)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {majorsQuery.data?.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لیست کاربران</CardTitle>
          <CardDescription>نمایش کاربران مطابق فیلترهای انتخابی</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">کاربری یافت نشد.</p>
          ) : (
            <ScrollArea className="rounded-md border">
              <table dir="rtl" className="w-full min-w-[700px] text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right">نام کامل</th>
                    <th className="px-3 py-2 text-right">نام کاربری</th>
                    <th className="px-3 py-2 text-right">ایمیل</th>
                    <th className="px-3 py-2 text-right">دانشگاه / گرایش</th>
                    <th className="px-3 py-2 text-right">وضعیت</th>
                    <th className="px-3 py-2 text-right">تاریخ عضویت</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2 text-right">
                        {(() => {
                          const parts = [user.first_name, user.last_name].filter(Boolean);
                          if (parts.length) return parts.join(' ');
                          return user.username;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right">{user.username}</td>
                      <td className="px-3 py-2 text-right">{user.email}</td>
                      <td className="px-3 py-2 text-right">
                        {user.major || '—'} · {user.university || '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={user.is_active ? 'default' : 'outline'}>
                          {user.is_active ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatJalali(user.date_joined)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>صفحه {formatNumberPersian(page)}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                قبلی
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!hasMore}
                onClick={() => setPage((prev) => prev + 1)}
              >
                بعدی
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsersPage;
