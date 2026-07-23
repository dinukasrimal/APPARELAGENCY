import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Users, UserPlus, Building2, Edit, Search, RefreshCw, KeyRound, UserCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { adminCreateAuthUser, adminCreateAuthUserMinimal, adminGeneratePasswordResetLink, adminDeleteUser, isAdminAvailable } from '@/integrations/supabase/admin';
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
  const [resetLink, setResetLink] = useState<string | null>(null);

  // Delete states
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isSuperuser = user.role === 'superuser';
  
  // Agency allocation states
  const [showAllocateUser, setShowAllocateUser] = useState(false);
  const [allocatingUser, setAllocatingUser] = useState(false);
  const [userToAllocate, setUserToAllocate] = useState<UserProfile | null>(null);
  const [selectedAgencyForAllocation, setSelectedAgencyForAllocation] = useState('');
  
  
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

      // Edge Function handles auth user + profile creation atomically
      const authResult = await adminCreateAuthUser(
        newUser.email,
        newUser.password,
        { name: newUser.name, role: newUser.role }
      );

      if (!authResult.user) {
        throw new Error('Failed to create user');
      }

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

  const generateResetLink = async () => {
    if (!resetUser) return;
    try {
      setResettingPassword(true);
      const link = await adminGeneratePasswordResetLink(resetUser.email);
      setResetLink(link);
    } catch (error: any) {
      toast({
        title: "Failed to Generate Link",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  // Delete a user (auth account + profile) via Edge Function
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setDeleting(true);
      await adminDeleteUser(userToDelete.id);
      toast({
        title: "User Deleted",
        description: `${userToDelete.name} has been removed.`,
      });
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Delete an agency (and unlink any users assigned to it)
  const handleDeleteAgency = async () => {
    if (!agencyToDelete) return;
    try {
      setDeleting(true);

      // Unlink users assigned to this agency so they aren't left with a stale reference
      await supabase
        .from('profiles')
        .update({ agency_id: null, agency_name: null })
        .eq('agency_id', agencyToDelete.id);

      const { error } = await supabase
        .from('agencies')
        .delete()
        .eq('id', agencyToDelete.id);

      if (error) throw error;

      toast({
        title: "Agency Deleted",
        description: `${agencyToDelete.name} has been removed.`,
      });
      setAgencyToDelete(null);
      fetchAgencies();
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete agency",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
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
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-semibold">{agency.name}</h4>
                  {isSuperuser && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAgencyToDelete(agency)}
                      className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
                  {isSuperuser && userProfile.id !== user.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserToDelete(userProfile)}
                      className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordReset} onOpenChange={(open) => {
        setShowPasswordReset(open);
        if (!open) { setResetUser(null); setResetLink(null); }
      }}>
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

              {!resetLink ? (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                    Click the button below to generate a secure password reset link. Copy the link and send it to the user via WhatsApp, SMS, or any other channel. No email is sent — no rate limits.
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowPasswordReset(false)}>
                      Cancel
                    </Button>
                    <Button onClick={generateResetLink} disabled={resettingPassword}>
                      {resettingPassword ? 'Generating...' : 'Generate Reset Link'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
                    Link generated. Send this to the user — it expires in 1 hour.
                  </div>
                  <div className="space-y-2">
                    <Label>Password Reset Link</Label>
                    <Textarea
                      readOnly
                      value={resetLink}
                      className="text-xs font-mono resize-none"
                      rows={4}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowPasswordReset(false)}>
                      Close
                    </Button>
                    <Button onClick={() => {
                      navigator.clipboard.writeText(resetLink);
                      toast({ title: "Copied", description: "Reset link copied to clipboard." });
                    }}>
                      Copy Link
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => { if (!open) setUserToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{userToDelete?.name}</strong> ({userToDelete?.email}) and their login account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteUser(); }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Agency Confirmation */}
      <AlertDialog open={!!agencyToDelete} onOpenChange={(open) => { if (!open) setAgencyToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agency</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{agencyToDelete?.name}</strong>. Users assigned to this agency will be unassigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteAgency(); }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Agency'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
