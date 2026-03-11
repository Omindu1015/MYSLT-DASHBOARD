import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App } from './App';
import { SystemHealth } from './pages/SystemHealth';
import { Dashboard } from './pages/Dashboard';
import { ApiDetailsTable } from './pages/ApiDetailsTable';
import { AdminPanel } from './pages/AdminPanel';
import { Login } from './pages/Login';

interface AppRouterProps {
  initialRedirect?: string | null;
}

export function AppRouter({ initialRedirect }: AppRouterProps) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<App />}>
          <Route index element={initialRedirect ? <Navigate to={initialRedirect} replace /> : <SystemHealth />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="api-details" element={<ApiDetailsTable />} />
          <Route path="admin" element={<AdminPanel />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
