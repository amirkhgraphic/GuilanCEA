import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Blog from "./pages/Blog";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPasswordRequest from './pages/ResetPasswordRequest';
import ResetPasswordConfirm from './pages/ResetPasswordConfirm';
import Events from "./pages/Events";
import EventDetail from './pages/EventDetail';
import EventFreeSuccessPage from './pages/EventFreeSuccessPage';
import PaymentResult from './pages/PaymentResult';
import Logout from './pages/Logout';
import AboutUs from "./pages/AboutUs";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
            </Route>
            
            <Route path="/admin" element={<Admin />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
