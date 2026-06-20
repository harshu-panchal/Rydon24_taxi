import { useLocation } from 'react-router-dom';
import RentalLocationTracker from '../modules/user/components/RentalLocationTracker';
import ScrollToTop from '../components/app/ScrollToTop';
import UserAccountInvalidationListener from '../components/app/UserAccountInvalidationListener';
import UserUpcomingRideReminderBootstrap from '../components/app/UserUpcomingRideReminderBootstrap';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const staticPages = [
    '/',
    '/about',
    '/contact',
    '/support',
    '/faq',
    '/services',
    '/privacy',
    '/privacy-policy',
    '/terms',
    '/terms-and-conditions',
    '/refund',
    '/cancellation',
    '/blog',
    '/links',
    '/careers',
  ];
  const isStaticPath = staticPages.includes(location.pathname);
  const isAdminPath =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/user-import') ||
    location.pathname.startsWith('/driver-import') ||
    location.pathname.startsWith('/owner');

  const content = isAdminPath ? (
    <div className="redigo-admin-root h-screen bg-gray-50 overflow-hidden">{children}</div>
  ) : isStaticPath ? (
    <div className="redigo-landing-root min-h-screen bg-white">
      <main className="min-h-screen">{children}</main>
    </div>
  ) : (
    <div className="redigo-app min-h-screen bg-gray-50/50">
      <main className="max-w-lg mx-auto shadow-2xl bg-white min-h-screen relative overflow-x-hidden">
        {children}
      </main>
    </div>
  );

  return (
    <>
      <RentalLocationTracker />
      <ScrollToTop />
      <UserAccountInvalidationListener />
      <UserUpcomingRideReminderBootstrap />
      {content}
    </>
  );
};

export default MainLayout;
