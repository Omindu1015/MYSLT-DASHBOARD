import { useState, useEffect } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { AppRouter } from './AppRouter';

// Azure AD app credentials from environment variables
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true,
  },
};

// Create the MSAL instance (not yet initialized)
const msalInstance = new PublicClientApplication(msalConfig);

export function MSALApp() {
  const [isInitialized, setIsInitialized] = useState(false);
  // Track redirect destination after auth
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    msalInstance
      .initialize()
      .then(() => {
        // Handle any auth code in the URL hash (Azure redirect response)
        return msalInstance.handleRedirectPromise();
      })
      .then((result) => {
        if (result && result.account) {
          // Azure returned an auth code via redirect — save auth to localStorage
          const account = result.account;
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('authToken', result.idToken);
          localStorage.setItem('userName', account.name || account.username || 'Admin');
          // Clean the #code=... hash from the URL without reloading
          window.history.replaceState(null, '', window.location.pathname);
          setRedirectTo('/dashboard');
        }
        setIsInitialized(true);
      })
      .catch((err) => {
        console.error('MSAL initialization failed:', err);
        setIsInitialized(true);
      });
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AppRouter initialRedirect={redirectTo} />
    </MsalProvider>
  );
}
