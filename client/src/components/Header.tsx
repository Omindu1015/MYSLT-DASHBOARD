
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../Logo/SLTMobitel_Logo.svg.png';
import { User, BarChart3, Server, LogOut, LogIn, Settings } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useMsal } from '@azure/msal-react';

export function Header() {
  const { instance } = useMsal();
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('Guest');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Re-check authentication status on every route change
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    const storedUserName = localStorage.getItem('userName');

    if (authStatus === 'true') {
      setIsAuthenticated(true);
      setUserName(storedUserName || 'Admin');
    } else {
      setIsAuthenticated(false);
      setUserName('Guest');
    }
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = () => {
    // Navigate to login page
    navigate('/login');
    setIsUserMenuOpen(false);
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    setUserName('Guest');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userName');
    setIsUserMenuOpen(false);
    try {
      await instance.logoutPopup();
    } catch {
      // ignore popup close
    }
    navigate('/login');
  };

  const handleAdminPanel = () => {
    navigate('/admin');
    setIsUserMenuOpen(false);
  };

  const navItems = [
    {
      path: '/dashboard',
      icon: BarChart3,
      label: 'Dashboard'
    },
    {
      path: '/',
      icon: Server,
      label: 'Servers'
    },
    {
      path: '/api-details',
      icon: Server,
      label: 'API Details'
    }

  ];

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6 flex-1 min-w-0">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="MySLT Logo" className="h-12 sm:h-14 w-auto object-contain select-none" />
        </Link>

        {/* Navigation Links */}
        <nav className="flex flex-wrap items-center gap-2">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${location.pathname === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
            >
              <item.icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {/* User Dropdown Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <User size={20} />
            <span className="text-sm font-medium">{userName}</span>
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-sm text-slate-400">Signed in as</p>
                <p className="text-sm font-semibold text-white mt-1">{userName}</p>
              </div>

              <div className="py-2">
                {isAuthenticated ? (
                  <>
                    <button
                      onClick={handleAdminPanel}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-3"
                    >
                      <Settings size={18} />
                      Admin Panel
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-3"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-slate-700 flex items-center gap-3"
                  >
                    <LogIn size={18} />
                    Login
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
