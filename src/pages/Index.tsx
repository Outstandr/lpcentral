import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/ui/loading-screen';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Starting Leaders Team..." />;
  }

  // Redirect based on auth state
  if (user) {
    return <Navigate to="/chat" replace />;
  }

  return <Navigate to="/auth" replace />;
};

export default Index;
