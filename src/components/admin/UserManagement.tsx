import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, UserPlus, Building2, Edit, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchAgencies();
  }, []);

  const fetchUsers = async () => {
    try {
      console.log('Fetching users...');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
      
      console.log('Fetched users data:', data);
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
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

  const createAgency = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .insert([{
          name: newAgency.name,
          address: newAgency.address,
          phone: newAgency.phone,
          email: newAgency.email,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agency created successfully",
      });

      setNewAgency({ name: '', address: '', phone: '', email: '' });
      setShowCreateAgency(false);
      fetchAgencies();
    } catch (error) {
      console.error('Error creating agency:', error);
      toast({
        title: "Error",
        description: "Failed to create agency",
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
            ))}
          </div>
        </CardContent>
      </Card>
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
