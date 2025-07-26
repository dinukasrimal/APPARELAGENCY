
import { useAuth } from '@/hooks/useAuth';
import AuthForm from '@/components/auth/AuthForm';
import Dashboard from '@/components/dashboard/Dashboard';
import { User } from '@/types/auth';

const Index = () => {
  const { user, session, loading, signOut } = useAuth();

  console.log('Index component - Auth state:', { user: !!user, session: !!session, loading });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth form if no user or session
  if (!user || !session) {
    return <AuthForm />;
  }

  // Convert Supabase user to our User type
  const appUser: User = {
    id: user.id,
    name: user.user_metadata?.name || user.email || 'Unknown User',
    email: user.email || '',
    role: (user.user_metadata?.role as 'agency' | 'superuser' | 'agent') || 'agent',
    agencyId: user.user_metadata?.agency_id,
    agencyName: user.user_metadata?.agency_name,
  };

  return <Dashboard user={appUser} onLogout={signOut} />;
};

export default Index;
