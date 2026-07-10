 
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
// import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

export function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Rotate between System Health ('/') and Dashboard ('/dashboard') every 5s
  // only while the user is currently on one of those two routes.
  useEffect(() => {
    const pathname = location.pathname;
    if (pathname !== '/' && pathname !== '/dashboard') return; // don't rotate on other pages

    const id = window.setInterval(() => {
      const current = window.location.pathname;
      const next = current === '/dashboard' ? '/' : '/dashboard';
      // use replace so history doesn't grow uncontrollably  change every 1 minute
      navigate(next, { replace: true });
    }, 200000000);

    return () => clearInterval(id);
  }, [location.pathname, navigate]);

  return <div className="flex w-full min-h-screen bg-slate-900 overflow-x-hidden">
      {/* <Sidebar /> */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>;
}
