import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getLocalUserToken } from '../modules/user/services/authService';
import { UserHome } from '../routes/lazyPages';

export const UserProtectedRoute = () => {
  const location = useLocation();

  if (!getLocalUserToken()) {
    const loginPath = location.pathname.startsWith('/taxi/user')
      ? '/taxi/user/login'
      : '/login';
    return <Navigate to={loginPath} replace />;
  }

  return <Outlet />;
};

export const UserHomeRoute = ({ taxiPrefixed = false }) =>
  getLocalUserToken() ? (
    <UserHome />
  ) : (
    <Navigate to={taxiPrefixed ? '/taxi/user/login' : '/login'} replace />
  );

export default UserProtectedRoute;
