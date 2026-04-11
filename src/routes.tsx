import { Navigate } from 'react-router';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import AdminPage from '@/pages/AdminPage';
import ProvozPage from '@/pages/ProvozPage';
import UcetniPage from '@/pages/UcetniPage';

export const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '/provoz', element: <ProvozPage /> },
  { path: '/ucetni', element: <UcetniPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];
