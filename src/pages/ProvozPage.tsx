import { Navigate } from 'react-router';

/** Legacy route – redirects to nested provoz layout. */
export default function ProvozPage() {
  return <Navigate to="/provoz/trzby" replace />;
}
