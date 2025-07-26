
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: { name: string; role?: string; agencyId?: string; agencyName?: string }) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (!mounted) return;
        
        if (event === 'SIGNED_OUT' || !session) {
          setSession(null);
          setUser(null);
        } else {
          setSession(session);
          setUser(session.user);
        }
        
        setLoading(false);
      }
    );

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('Error getting session:', error);
          setSession(null);
          setUser(null);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Unexpected error getting session:', error);
        setSession(null);
        setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, userData: { name: string; role?: string; agencyId?: string; agencyName?: string }) => {
    try {
      console.log('Attempting signup with userData:', userData);
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        toast({
          title: "Signup Failed",
          description: signUpError.message,
          variant: "destructive",
        });
        return { error: signUpError };
      }

      if (data.user && data.user.email_confirmed_at) {
        console.log('User confirmed, creating profile manually');
        
        const userRole = userData.role || 'agent';
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name: userData.name,
            email: email,
            role: userRole as 'agent' | 'agency' | 'superuser',
            agency_id: userData.agencyId || null,
            agency_name: userData.agencyName || null
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }

      toast({
        title: "Account Created",
        description: "Please check your email to verify your account.",
      });

      return { error: null };
    } catch (error) {
      console.error('Unexpected signup error:', error);
      toast({
        title: "Signup Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting signin for:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Signin error:', error);
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      if (data.session) {
        toast({
          title: "Welcome back!",
          description: "You have been successfully logged in.",
        });
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected signin error:', error);
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Attempting to sign out...');
      
      // Clear local state first
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Signout error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Successfully signed out');
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
      }
    } catch (error) {
      console.error('Unexpected signout error:', error);
      // Clear local state even if there's an error
      setUser(null);
      setSession(null);
      toast({
        title: "Logged out",
        description: "Session cleared locally.",
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
