import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { AuthProvider } from "./contexts/AuthContext";
import AdminLayout from "./pages/AdminLayout";
import AdminUsers from "./pages/AdminUsers";
import AdminEvents from "./pages/AdminEvents";
import AdminEventEdit from "./pages/AdminEventEdit";
import AboutUs from "./pages/AboutUs";
import Auth from "./pages/Auth";
import Blog from "./pages/Blog";
import EventDetail from "./pages/EventDetail";
import EventFreeSuccessPage from "./pages/EventFreeSuccessPage";
import Events from "./pages/Events";
import Home from "./pages/Home";
import Logout from "./pages/Logout";
import NotFound from "./pages/NotFound";
import PaymentResult from "./pages/PaymentResult";
import Profile from "./pages/Profile";
import ResetPasswordConfirm from "./pages/ResetPasswordConfirm";
import ResetPasswordRequest from "./pages/ResetPasswordRequest";
import VerifyEmail from "./pages/VerifyEmail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HelmetProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="auth" element={<Auth />} />
                <Route path="logout" element={<Logout />} />
                <Route path="profile" element={<Profile />} />
                <Route path="blog" element={<Blog />} />
                <Route path="events" element={<Events />} />
                <Route path="events/:slug" element={<EventDetail />} />
                <Route path="events/:slug/success" element={<EventFreeSuccessPage />} />
                <Route path="payments/result" element={<PaymentResult />} />
                <Route path="verify-email/:token" element={<VerifyEmail />} />
                <Route path="reset-password" element={<ResetPasswordRequest />} />
                <Route path="reset-password/:token" element={<ResetPasswordConfirm />} />
                <Route path="/about" element={<AboutUs />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/users" replace />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="events/:id/edit" element={<AdminEventEdit />} />
              </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </HelmetProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
