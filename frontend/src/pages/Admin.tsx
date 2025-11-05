import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">در حال بارگذاری...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user?.is_staff) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">پنل مدیریت</h1>

        <Tabs defaultValue="users" dir="rtl">
          <TabsList>
            <TabsTrigger value="users">کاربران</TabsTrigger>
            <TabsTrigger value="posts">مقالات</TabsTrigger>
            <TabsTrigger value="events">رویدادها</TabsTrigger>
            <TabsTrigger value="comments">نظرات</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>مدیریت کاربران</CardTitle>
                <CardDescription>مشاهده و مدیریت کاربران سیستم</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  این بخش در حال توسعه است
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>مدیریت مقالات</CardTitle>
                <CardDescription>مشاهده، ویرایش و حذف مقالات</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  این بخش در حال توسعه است
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>مدیریت رویدادها</CardTitle>
                <CardDescription>مشاهده، ویرایش و حذف رویدادها</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  این بخش در حال توسعه است
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>مدیریت نظرات</CardTitle>
                <CardDescription>تایید، رد یا حذف نظرات</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  این بخش در حال توسعه است
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
