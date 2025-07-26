
import { useAuth } from '@/hooks/useAuth';
import AuthForm from '@/components/auth/AuthForm';
import Dashboard from '@/components/dashboard/Dashboard';
import { User } from '@/types/auth';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { user, session, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  console.log('Index component - Auth state:', { user: !!user, session: !!session, loading });

  // Fetch user profile data from database
  useEffect(() => {
    if (user && !profile) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    try {
      console.log('Fetching profile for user:', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, agency_id, agency_name')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // Use fallback data from user metadata if profile fetch fails
        setProfile({
          id: user.id,
          name: user.user_metadata?.name || user.email || 'Unknown User',
          role: user.user_metadata?.role || 'agent',
          agency_id: user.user_metadata?.agency_id,
          agency_name: user.user_metadata?.agency_name
        });
      } else {
        console.log('Profile data fetched:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading || profileLoading) {
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

  // Wait for profile to load
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Convert profile data to our User type
  const appUser: User = {
    id: user.id,
    name: profile.name || user.email || 'Unknown User',
    email: user.email || '',
    role: profile.role || 'agent',
    agencyId: profile.agency_id,
    agencyName: profile.agency_name,
  };

  console.log('App user data:', appUser);

  return <Dashboard user={appUser} onLogout={signOut} />;
};

export default Index;
