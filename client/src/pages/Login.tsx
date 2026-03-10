import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import logo from '../Logo/SLTMobitel_Logo.svg.png';
import { AlertCircle } from 'lucide-react';

export function Login() {
  const { instance, inProgress } = useMsal();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If MSAL is already handling a redirect or popup, don't show the login button
  if (inProgress !== 'none') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const handleAzureLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const result = await instance.loginPopup({
        scopes: ['User.Read'],
      });
      // Store auth state so Header.tsx can read it
      const account = result.account;
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authToken', result.idToken);
      localStorage.setItem('userName', account?.name || account?.username || 'Admin');
      navigate('/dashboard');
    } catch (err: any) {
      // Ignore user-cancelled popups (MSAL uses different codes depending on version/flow)
      const code: string = err?.errorCode ?? err?.error ?? '';
      const message: string = err?.message ?? '';
      const isCancelled =
        code === 'user_cancelled' ||
        code === 'user_cancel' ||
        code === 'access_denied' ||
        message.toLowerCase().includes('cancel') ||
        message.toLowerCase().includes('user closed');
      if (!isCancelled) {
        setError('Azure login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
          <h2 className="text-2xl font-bold text-white text-center mb-2">Welcome</h2>
          <p className="text-slate-400 text-sm text-center mb-8">
            Sign in with your Microsoft organization account to continue.
          </p>

          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Microsoft Sign-In Button */}
          <button
            type="button"
            onClick={handleAzureLogin}
            disabled={isLoading}
            className="w-full py-3 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                {/* Official Microsoft logo SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                Sign in with Microsoft
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          © 2025 MySLT Monitoring. All rights reserved.
        </p>
      </div>
    </div>
  );
}
