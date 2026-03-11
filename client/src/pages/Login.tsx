import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import logo from '../Logo/SLTMobitel_Logo.svg.png';
import { AlertCircle, User, Lock, LogIn, Mail, UserPlus } from 'lucide-react';

export function Login() {
  const { instance, inProgress } = useMsal();
  const navigate = useNavigate();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAzureLoading, setIsAzureLoading] = useState(false);

  // If MSAL is busy for too long (e.g. stuck popup), reset after 8 seconds
  useEffect(() => {
    if (inProgress !== 'none') {
      const timeout = setTimeout(() => {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('msal.'))
          .forEach((k) => sessionStorage.removeItem(k));
        window.location.reload();
      }, 8000);
      return () => clearTimeout(timeout);
    }
  }, [inProgress]);

  const resetForm = () => {
    setUsername(''); setPassword(''); setConfirmPassword('');
    setEmail(''); setFullName(''); setError(''); setSuccess('');
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userName', data.data.user.fullName);
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('userRole', data.data.user.role);
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, fullName, role: 'admin' }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Account created! You can now sign in.');
        setTimeout(() => { setIsRegisterMode(false); resetForm(); }, 2000);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAzureLogin = async () => {
    setError('');
    setIsAzureLoading(true);
    try {
      // Use redirect flow so Azure returns to the main window, not a popup.
      // MSALApp.tsx's handleRedirectPromise() will process the result on return.
      await instance.loginRedirect({ scopes: ['User.Read'] });
      // Page navigates away on success — no code runs after this point
    } catch (err: any) {
      console.error('MSAL login error (caught in Login component):', err);
      const code: string = err?.errorCode ?? err?.error ?? '';
      const message: string = err?.message ?? '';
      const isCancelled =
        code === 'user_cancelled' || code === 'user_cancel' || code === 'access_denied' ||
        message.toLowerCase().includes('cancel') || message.toLowerCase().includes('user closed') ||
        message.toLowerCase().includes('popup_window_error');
      if (!isCancelled) {
        setError('Azure login failed. Please try again.');
        console.error('MSAL login error:', err);
      }
      setIsAzureLoading(false);
    }
  };

  // Show spinner while MSAL is processing
  if (inProgress !== 'none') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-slate-400 text-sm">Authenticating... (will reset if stuck)</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="MySLT Logo" className="mx-auto h-20 w-auto object-contain select-none mb-2" />
          <p className="text-slate-400 text-sm">Admin Portal</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          <h2 className="text-2xl font-bold text-white text-center mb-6">
            {isRegisterMode ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} className="text-green-400 shrink-0" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={isRegisterMode ? handleRegister : handleAdminLogin} className="space-y-4 mb-4">
            {/* Full Name — register only */}
            {isRegisterMode && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name" required
                    className="w-full pl-9 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username" required
                  className="w-full pl-9 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>

            {/* Email — register only */}
            {isRegisterMode && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email" required
                    className="w-full pl-9 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password" required
                  className="w-full pl-9 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>

            {/* Confirm Password — register only */}
            {isRegisterMode && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password" required
                    className="w-full pl-9 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2">
              {isLoading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isRegisterMode ? 'Creating account...' : 'Signing in...'}</>
              ) : (
                <>{isRegisterMode ? <UserPlus size={18} /> : <LogIn size={18} />}
                  {isRegisterMode ? 'Create Account' : 'Sign In'}</>
              )}
            </button>
          </form>

          {/* Toggle Login / Register */}
          <div className="text-center mb-4">
            <button onClick={() => { setIsRegisterMode(!isRegisterMode); resetForm(); }}
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
              {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>

          {/* Azure SSO — login mode only */}
          {!isRegisterMode && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-600" />
                <span className="text-slate-500 text-xs font-medium">OR</span>
                <div className="flex-1 h-px bg-slate-600" />
              </div>
              <button type="button" onClick={handleAzureLogin} disabled={isAzureLoading}
                className="w-full py-3 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-3">
                {isAzureLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 21 21">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                    </svg>
                    Sign in with Microsoft
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          © 2025 MySLT Monitoring. All rights reserved.
        </p>
      </div>
    </div>
  );
}
