import { Navigate } from 'react-router';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import AdminPage from '@/pages/AdminPage';
import ProvozLayout from '@/pages/provoz/ProvozLayout';
import ProvozIndexRedirect from '@/pages/provoz/ProvozIndexRedirect';
import { ProvozRouteGuard } from '@/pages/provoz/ProvozRouteGuard';
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
      { index: true, element: <ProvozIndexRedirect /> },
      {
        path: 'trzby',
        element: (
          <ProvozRouteGuard>
            <ProvozTrzbyTab />
          </ProvozRouteGuard>
        ),
      },
      {
        path: 'zamestnanci',
        element: (
          <ProvozRouteGuard>
            <WorkersListPage />
          </ProvozRouteGuard>
        ),
      },
      {
        path: 'zamestnanci/:id',
        element: (
          <ProvozRouteGuard>
            <WorkerDetailPage />
          </ProvozRouteGuard>
        ),
      },
      {
        path: 'plan',
        element: (
          <ProvozRouteGuard>
            <ShiftPlanPage />
          </ProvozRouteGuard>
        ),
      },
      {
        path: 'kos',
        element: (
          <ProvozRouteGuard>
            <TrashPage />
          </ProvozRouteGuard>
        ),
      },
    ],
  },
  { path: '/dochazka', element: <DochazkaPage /> },
  { path: '/ucetni', element: <UcetniPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];
