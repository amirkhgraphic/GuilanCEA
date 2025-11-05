import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTop from './ScrollToTop';

export default function Layout() {
  return (
    <div className="min-h-screen">
      <ScrollToTop onlyOnPush={false} smooth={false} />
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
