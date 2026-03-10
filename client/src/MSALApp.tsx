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

const msalInstance = new PublicClientApplication(msalConfig);

export function MSALApp() {
  return (
    <MsalProvider instance={msalInstance}>
      <AppRouter />
    </MsalProvider>
  );
}
