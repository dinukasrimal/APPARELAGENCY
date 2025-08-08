import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Users, UserPlus, Building2, Edit, Search, RefreshCw, KeyRound, Mail, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { adminCreateAuthUser, adminCreateAuthUserMinimal, isAdminAvailable } from '@/integrations/supabase/admin';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'agency' | 'superuser' | 'agent';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  agency_id?: string;
  agency_name?: string;
  created_at: string;
}

interface Agency {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface UserManagementProps {
  user: User;
}

const UserManagement = ({ user }: UserManagementProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newAgency, setNewAgency] = useState({ name: '', address: '', phone: '', email: '' });
  const [showCreateAgency, setShowCreateAgency] = useState(false);
  
  // User creation states
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent' as UserRole,
    agencyId: '',
    agencyName: ''
  });
  
  // Password reset states
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetUser, setResetUser] = useState<UserProfile | null>(null);
  
  // Agency allocation states
  const [showAllocateUser, setShowAllocateUser] = useState(false);
  const [allocatingUser, setAllocatingUser] = useState(false);
  const [userToAllocate, setUserToAllocate] = useState<UserProfile | null>(null);
  const [selectedAgencyForAllocation, setSelectedAgencyForAllocation] = useState('');
  
  // Email testing states
  const [showEmailTest, setShowEmailTest] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchAgencies();
  }, []);

  const fetchUsers = async () => {
    try {
      console.log('Fetching users...');
      console.log('Current user info:', user);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        console.error('Error details:', error.details, error.hint, error.code);
        throw error;
      }
      
      console.log('Fetched users data:', data);
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to fetch users";
      if (error.code === '42P17') {
        errorMessage = "Database policy error - infinite recursion detected. Please run the fix_infinite_recursion.sql script.";
      } else if (error.message?.includes('RLS')) {
        errorMessage = "Permission denied - Row Level Security blocking access";
      } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        errorMessage = "Profiles table not found - database setup issue";
      } else if (error.code === 'PGRST301') {
        errorMessage = "No permission to read profiles table";
      } else if (error.message) {
        errorMessage = `Database error: ${error.message}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencies = async () => {
    try {
      console.log('Fetching agencies...');
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching agencies:', error);
        throw error;
      }
      
      console.log('Fetched agencies data:', data);
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
    }
  };

  const refreshData = async () => {
    console.log('Starting data refresh...');
    setRefreshing(true);
    try {
      await Promise.all([fetchUsers(), fetchAgencies()]);
      toast({
        title: "Success",
        description: "Data refreshed successfully",
      });
      console.log('Data refresh completed successfully');
    } catch (error) {
      console.error('Error during refresh:', error);
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole, agencyId?: string, agencyName?: string) => {
    try {
      const { data, error } = await supabase.rpc('update_user_role', {
        target_user_id: userId,
        new_role: newRole,
        new_agency_id: agencyId || null,
        new_agency_name: agencyName || null
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      fetchUsers();
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  // Create new user function
  const createUser = async () => {
    try {
      setCreatingUser(true);

      // Validate required fields
      if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUser.email)) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }

      // Validate password strength
      if (newUser.password.length < 6) {
        toast({
          title: "Validation Error",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        });
        return;
      }

      // Check if admin functionality is available
      if (!isAdminAvailable()) {
        toast({
          title: "Admin Required",
          description: "User creation requires admin privileges. Please configure VITE_SUPABASE_SERVICE_ROLE_KEY in environment.",
          variant: "destructive",
        });
        return;
      }

      console.log('Creating user with admin privileges:', {
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      });

      // Step 1: Create Supabase Auth user (minimal approach to avoid trigger issues)
      console.log('Creating Supabase Auth user with minimal data...');
      
      // Use minimal auth user creation to avoid trigger conflicts
      const authResult = await adminCreateAuthUserMinimal(
        newUser.email,
        newUser.password
      );

      if (!authResult.user) {
        throw new Error('Failed to create auth user - no user returned');
      }

      const authUserId = authResult.user.id;
      console.log('Auth user created successfully with ID:', authUserId);
      console.log('Profile should be auto-created by database trigger');

      // Step 2: Create profile manually with matching ID
      console.log('Creating profile manually with matching ID:', authUserId);
      
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUserId,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          agency_id: null,
          agency_name: null,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        
        // If profile already exists (maybe created by trigger), try to update it
        if (profileError.code === '23505' || profileError.message?.includes('duplicate key')) {
          console.log('Profile already exists, updating instead...');
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              name: newUser.name,
              role: newUser.role
            })
            .eq('id', authUserId);
            
          if (updateError) {
            console.error('Profile update error:', updateError);
            throw updateError;
          }
        } else {
          throw profileError;
        }
      }
      
      console.log('Profile created successfully');

      console.log('User created successfully - Auth ID and Profile ID match:', authUserId);

      toast({
        title: "Success", 
        description: `User created successfully! ${newUser.name} can now login with their email and receive password reset emails. You can allocate them to an agency if needed.`,
      });

      // Reset form and close dialog
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'agent',
        agencyId: '',
        agencyName: ''
      });
      setShowCreateUser(false);
      fetchUsers();

    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Provide more detailed error messages
      let errorMessage = "Failed to create user";
      
      if (error.message?.includes('User already registered')) {
        errorMessage = "A user with this email already exists in the auth system";
      } else if (error.message?.includes('profiles_email_key')) {
        errorMessage = "A user with this email already exists in profiles";
      } else if (error.message?.includes('Invalid email')) {
        errorMessage = "Invalid email address format";
      } else if (error.message?.includes('Password should be')) {
        errorMessage = "Password does not meet requirements";
      } else if (error.message?.includes('service_role')) {
        errorMessage = "Admin privileges required. Check service role key configuration.";
      } else if (error.message?.includes('Admin client not available')) {
        errorMessage = "Admin functionality not available. Please configure VITE_SUPABASE_SERVICE_ROLE_KEY.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "User Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  // Email-based password reset function with enhanced debugging
  const sendPasswordResetEmail = async () => {
    try {
      setResettingPassword(true);

      if (!resetUser) {
        toast({
          title: "Error",
          description: "No user selected for password reset",
          variant: "destructive",
        });
        return;
      }

      console.log('=== EMAIL RESET DEBUG START ===');
      console.log(`Target user:`, resetUser);
      console.log(`Email address:`, resetUser.email);
      console.log(`Current origin:`, window.location.origin);
      console.log(`Redirect URL:`, `${window.location.origin}/reset-password`);
      
      // Important: We can only see users in our profiles table, not Supabase auth users
      // Supabase will only send emails to users that actually exist in the auth system
      console.log('Note: Email will only be sent if user exists in Supabase Auth (not just profiles table)');
      
      // Send password reset email using Supabase auth
      console.log('Calling supabase.auth.resetPasswordForEmail...');
      const { data, error } = await supabase.auth.resetPasswordForEmail(resetUser.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      console.log('Response data:', data);
      console.log('Response error:', error);

      if (error) {
        console.error('=== EMAIL SEND ERROR ===');
        console.error('Error object:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        throw error;
      }

      console.log('=== EMAIL SENT SUCCESSFULLY ===');
      console.log(`Email sent to: ${resetUser.email}`);
      console.log('Data returned:', data);

      toast({
        title: "Password Reset Request Sent",
        description: `Request processed for ${resetUser.email}. Note: Emails are only sent to users who have active accounts in our system. Check your inbox and spam folder if this user exists.`,
      });

      // Close dialog
      setShowPasswordReset(false);
      setResetUser(null);

    } catch (error: any) {
      console.error('=== EMAIL RESET ERROR CAUGHT ===');
      console.error('Full error object:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error.constructor.name);
      
      if (error && typeof error === 'object') {
        console.error('Error properties:');
        Object.keys(error).forEach(key => {
          console.error(`  ${key}:`, error[key]);
        });
      }
      
      let errorMessage = "Failed to send password reset email";
      let troubleshooting = "";
      let debugInfo = "";
      
      if (error.message?.includes('Email rate limit exceeded')) {
        errorMessage = "Too many email requests. Please try again in a few minutes.";
        troubleshooting = "Rate limit reached - wait 5-10 minutes before trying again.";
      } else if (error.message?.includes('Invalid email')) {
        errorMessage = "Invalid email address format";
        troubleshooting = "Please check if the user's email address is correct.";
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = "User email not verified";
        troubleshooting = "The user may need to verify their email first.";
      } else if (error.message?.includes('SMTP')) {
        errorMessage = "SMTP configuration issue";
        troubleshooting = "Check your SMTP settings in Supabase dashboard.";
        debugInfo = `SMTP Error: ${error.message}`;
      } else if (error.message?.includes('Network')) {
        errorMessage = "Network connection issue";
        troubleshooting = "Check your internet connection and try again.";
      } else if (error.code) {
        errorMessage = `Supabase error (${error.code})`;
        troubleshooting = `Error code: ${error.code}. Check Supabase dashboard logs.`;
        debugInfo = `Full error: ${JSON.stringify(error, null, 2)}`;
      } else if (error.message) {
        errorMessage = error.message;
        troubleshooting = "Check browser console for detailed logs.";
        debugInfo = `Error details logged to console`;
      } else {
        errorMessage = "Unknown error occurred";
        troubleshooting = "Check browser console and Supabase logs.";
        debugInfo = "No specific error message available";
      }
      
      console.error('Processed error message:', errorMessage);
      console.error('Troubleshooting advice:', troubleshooting);
      console.error('Debug info:', debugInfo);
      
      toast({
        title: "Email Send Failed",
        description: `${errorMessage}. ${troubleshooting}`,
        variant: "destructive",
      });
      
      // Show debug info in a separate toast for development
      if (debugInfo) {
        setTimeout(() => {
          toast({
            title: "Debug Information",
            description: debugInfo,
            variant: "default",
          });
        }, 1000);
      }
      
    } finally {
      setResettingPassword(false);
      console.log('=== EMAIL RESET DEBUG END ===');
    }
  };

  // Test email function to verify SMTP configuration
  const testEmailConfiguration = async () => {
    try {
      setTestingEmail(true);

      if (!testEmailAddress || !testEmailAddress.includes('@')) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }

      console.log('=== EMAIL CONFIGURATION TEST START ===');
      console.log(`Test email address: ${testEmailAddress}`);
      
      // Try to send password reset to test email
      const { data, error } = await supabase.auth.resetPasswordForEmail(testEmailAddress, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      console.log('Test email response data:', data);
      console.log('Test email response error:', error);

      if (error) {
        console.error('=== EMAIL TEST ERROR ===');
        console.error('Error details:', error);
        
        let message = "Email test failed";
        if (error.message?.includes('rate limit')) {
          message = "Rate limit exceeded. Wait a few minutes and try again.";
        } else if (error.message?.includes('SMTP')) {
          message = `SMTP Configuration Issue: ${error.message}`;
        } else {
          message = `Error: ${error.message}`;
        }
        
        toast({
          title: "Email Test Failed",
          description: message,
          variant: "destructive",
        });
        return;
      }

      console.log('=== EMAIL TEST SUCCESS ===');
      toast({
        title: "Email Test Sent",
        description: `Test email sent to ${testEmailAddress}. Check inbox and spam folder. If received, your SMTP is working.`,
      });

      setShowEmailTest(false);
      setTestEmailAddress('');

    } catch (error: any) {
      console.error('Email test error:', error);
      toast({
        title: "Email Test Error",
        description: `Failed to test email: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  // Allocate user to agency function
  const allocateUserToAgency = async () => {
    try {
      setAllocatingUser(true);

      if (!userToAllocate) {
        toast({
          title: "Error",
          description: "No user selected for allocation",
          variant: "destructive",
        });
        return;
      }

      if (!selectedAgencyForAllocation) {
        toast({
          title: "Validation Error",
          description: "Please select an agency",
          variant: "destructive",
        });
        return;
      }

      const selectedAgency = agencies.find(agency => agency.id === selectedAgencyForAllocation);
      if (!selectedAgency) {
        toast({
          title: "Error",
          description: "Selected agency not found",
          variant: "destructive",
        });
        return;
      }

      // Update user profile with agency information
      const { error } = await supabase
        .from('profiles')
        .update({
          agency_id: selectedAgency.id,
          agency_name: selectedAgency.name,
        })
        .eq('id', userToAllocate.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User ${userToAllocate.name} has been allocated to ${selectedAgency.name}`,
      });

      // Reset form and close dialog
      setSelectedAgencyForAllocation('');
      setShowAllocateUser(false);
      setUserToAllocate(null);
      fetchUsers(); // Refresh users list

    } catch (error: any) {
      console.error('Error allocating user to agency:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to allocate user to agency",
        variant: "destructive",
      });
    } finally {
      setAllocatingUser(false);
    }
  };

  const createAgency = async () => {
    try {
      console.log('Creating agency with data:', newAgency);
      
      // Validate required fields
      if (!newAgency.name.trim() || !newAgency.email.trim()) {
        toast({
          title: "Validation Error",
          description: "Agency name and email are required",
          variant: "destructive",
        });
        return;
      }

      // Create only the agency record - no automatic profile creation
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .insert([{
          name: newAgency.name,
          address: newAgency.address,
          phone: newAgency.phone,
          email: newAgency.email,
          created_by: user.id
        }])
        .select()
        .single();

      if (agencyError) {
        console.error('Agency creation error:', agencyError);
        throw agencyError;
      }

      console.log('Agency created successfully:', agencyData);

      toast({
        title: "Success",
        description: "Agency created successfully. You can now create users and allocate them to this agency.",
      });

      setNewAgency({ name: '', address: '', phone: '', email: '' });
      setShowCreateAgency(false);
      fetchAgencies();
    } catch (error: any) {
      console.error('Error creating agency:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create agency",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superuser': return 'bg-red-100 text-red-800';
      case 'agency': return 'bg-blue-100 text-blue-800';
      case 'agent': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user.role !== 'superuser') {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">Only superusers can access user management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600">Manage users, roles, and agencies</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={refreshData} 
            disabled={refreshing}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          
          <Dialog open={showEmailTest} onOpenChange={setShowEmailTest}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Test Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Test Email Configuration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Send a test password reset email to verify your SMTP configuration is working.
                </p>
                
                <div>
                  <Label htmlFor="test-email">Test Email Address</Label>
                  <Input
                    id="test-email"
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="Enter your email to test"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEmailTest(false)}>
                    Cancel
                  </Button>
                  <Button onClick={testEmailConfiguration} disabled={testingEmail || !testEmailAddress}>
                    {testingEmail ? 'Sending...' : 'Send Test Email'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <UserPlus className="h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Enter password (min 6 characters)"
                  />
                </div>
                
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUser.role} onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="agency">Agency Manager</SelectItem>
                      <SelectItem value="superuser">Superuser</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateUser(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createUser} disabled={creatingUser}>
                    {creatingUser ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCreateAgency} onOpenChange={setShowCreateAgency}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Create Agency
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Agency</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="agency-name">Agency Name</Label>
                  <Input
                    id="agency-name"
                    value={newAgency.name}
                    onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
                    placeholder="Enter agency name"
                  />
                </div>
                <div>
                  <Label htmlFor="agency-address">Address</Label>
                  <Input
                    id="agency-address"
                    value={newAgency.address}
                    onChange={(e) => setNewAgency({ ...newAgency, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>
                <div>
                  <Label htmlFor="agency-phone">Phone</Label>
                  <Input
                    id="agency-phone"
                    value={newAgency.phone}
                    onChange={(e) => setNewAgency({ ...newAgency, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="agency-email">Email</Label>
                  <Input
                    id="agency-email"
                    type="email"
                    value={newAgency.email}
                    onChange={(e) => setNewAgency({ ...newAgency, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <Button onClick={createAgency} className="w-full" disabled={!newAgency.name}>
                  Create Agency
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Agencies Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Agencies ({agencies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agencies.map((agency) => (
              <div key={agency.id} className="border rounded-lg p-4">
                <h4 className="font-semibold">{agency.name}</h4>
                {agency.address && <p className="text-sm text-gray-600">{agency.address}</p>}
                {agency.phone && <p className="text-sm text-gray-600">{agency.phone}</p>}
                {agency.email && <p className="text-sm text-gray-600">{agency.email}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users ({filteredUsers.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((userProfile) => (
              <div key={userProfile.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold">{userProfile.name}</h4>
                    <Badge className={getRoleBadgeColor(userProfile.role)}>
                      {userProfile.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{userProfile.email}</p>
                  {userProfile.agency_name && (
                    <p className="text-sm text-gray-500">Agency: {userProfile.agency_name}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    Joined: {new Date(userProfile.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!userProfile.agency_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUserToAllocate(userProfile);
                        setShowAllocateUser(true);
                      }}
                      className="text-blue-600 hover:text-blue-700 border-blue-300 hover:bg-blue-50"
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Allocate to Agency
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResetUser(userProfile);
                      setShowPasswordReset(true);
                    }}
                    className="text-orange-600 hover:text-orange-700 border-orange-300 hover:bg-orange-50"
                  >
                    <KeyRound className="h-4 w-4 mr-1" />
                    Reset Password
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingUser(userProfile)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit User Role</DialogTitle>
                      </DialogHeader>
                      {editingUser && (
                        <EditUserForm
                          user={editingUser}
                          agencies={agencies}
                          onSave={updateUserRole}
                          onCancel={() => setEditingUser(null)}
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          {resetUser && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="font-medium">{resetUser.name}</p>
                <p className="text-sm text-gray-600">{resetUser.email}</p>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <Mail className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-800">Email Password Reset</h4>
                      <p className="text-sm text-green-700 mt-1">
                        A secure password reset email will be sent to the user's email address. The user can then set their own new password.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Reset Email Will Be Sent To</Label>
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{resetUser.name}</p>
                        <p className="text-sm text-gray-600">{resetUser.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <div className="text-blue-600">ℹ️</div>
                    <div>
                      <h5 className="font-medium text-blue-800 text-sm">How Password Reset Works:</h5>
                      <ul className="text-xs text-blue-700 mt-1 space-y-1">
                        <li>• <strong>User must have signed up before</strong> to receive email</li>
                        <li>• Profile in database ≠ Auth account (users need both)</li>
                        <li>• System always shows "success" for security</li>
                        <li>• Only real authenticated users get reset emails</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <div className="text-yellow-600">⚠️</div>
                    <div>
                      <h5 className="font-medium text-yellow-800 text-sm">Email Delivery:</h5>
                      <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                        <li>• Check spam/junk folder if email doesn't arrive</li>
                        <li>• Email may take 2-5 minutes to arrive</li>
                        <li>• User must click the link to reset password</li>
                        <li>• Link expires after 1 hour for security</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowPasswordReset(false)}>
                    Cancel
                  </Button>
                  <Button onClick={sendPasswordResetEmail} disabled={resettingPassword}>
                    {resettingPassword ? 'Sending Email...' : 'Send Reset Email'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Agency Allocation Dialog */}
      <Dialog open={showAllocateUser} onOpenChange={setShowAllocateUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate User to Agency</DialogTitle>
          </DialogHeader>
          {userToAllocate && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="font-medium">{userToAllocate.name}</p>
                <p className="text-sm text-gray-600">{userToAllocate.email}</p>
                <p className="text-sm text-gray-500">Role: {userToAllocate.role}</p>
              </div>
              
              <div>
                <Label htmlFor="agency-select">Select Agency</Label>
                <Select value={selectedAgencyForAllocation} onValueChange={setSelectedAgencyForAllocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAllocateUser(false)}>
                  Cancel
                </Button>
                <Button onClick={allocateUserToAgency} disabled={allocatingUser || !selectedAgencyForAllocation}>
                  {allocatingUser ? 'Allocating...' : 'Allocate User'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface EditUserFormProps {
  user: UserProfile;
  agencies: Agency[];
  onSave: (userId: string, role: UserRole, agencyId?: string, agencyName?: string) => void;
  onCancel: () => void;
}

const EditUserForm = ({ user, agencies, onSave, onCancel }: EditUserFormProps) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [selectedAgency, setSelectedAgency] = useState(user.agency_id || '');

  const handleSave = () => {
    const agency = agencies.find(a => a.id === selectedAgency);
    onSave(
      user.id,
      selectedRole,
      selectedRole === 'agent' || selectedRole === 'agency' ? selectedAgency : undefined,
      selectedRole === 'agent' || selectedRole === 'agency' ? agency?.name : undefined
    );
  };

  const handleRoleChange = (value: string) => {
    setSelectedRole(value as UserRole);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>User</Label>
        <div className="p-2 bg-gray-50 rounded">
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
      </div>
      
      <div>
        <Label htmlFor="role">Role</Label>
        <Select value={selectedRole} onValueChange={handleRoleChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="agency">Agency Manager</SelectItem>
            <SelectItem value="superuser">Superuser</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(selectedRole === 'agent' || selectedRole === 'agency') && (
        <div>
          <Label htmlFor="agency">Agency</Label>
          <Select value={selectedAgency} onValueChange={setSelectedAgency}>
            <SelectTrigger>
              <SelectValue placeholder="Select an agency" />
            </SelectTrigger>
            <SelectContent>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSave} className="flex-1">
          Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default UserManagement;
