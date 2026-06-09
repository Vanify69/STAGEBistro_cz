import { Navigate } from 'react-router';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import AdminPage from '@/pages/AdminPage';
import ProvozLayout from '@/pages/provoz/ProvozLayout';
import ProvozTrzbyTab from '@/pages/provoz/ProvozTrzbyTab';
import WorkersListPage from '@/pages/provoz/WorkersListPage';
import WorkerDetailPage from '@/pages/provoz/WorkerDetailPage';
import ShiftPlanPage from '@/pages/provoz/ShiftPlanPage';
import TrashPage from '@/pages/provoz/TrashPage';
import DochazkaPage from '@/pages/dochazka/DochazkaPage';
import UcetniPage from '@/pages/UcetniPage';

export const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/admin', element: <AdminPage /> },
  {
    path: '/provoz',
    element: <ProvozLayout />,
    children: [
      { index: true, element: <Navigate to="trzby" replace /> },
      { path: 'trzby', element: <ProvozTrzbyTab /> },
      { path: 'zamestnanci', element: <WorkersListPage /> },
      { path: 'zamestnanci/:id', element: <WorkerDetailPage /> },
      { path: 'plan', element: <ShiftPlanPage /> },
      { path: 'kos', element: <TrashPage /> },
    ],
  },
  { path: '/dochazka', element: <DochazkaPage /> },
  { path: '/ucetni', element: <UcetniPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];
