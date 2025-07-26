
import { useState } from 'react';
import { User } from '@/types/auth';
import { Dispute } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertTriangle, Clock, CheckCircle, XCircle, Search, User as UserIcon } from 'lucide-react';

interface DisputeManagementProps {
  user: User;
  disputes: Dispute[];
  onCreateDispute: (dispute: Omit<Dispute, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateDispute: (id: string, updates: Partial<Dispute>) => void;
}

const DisputeManagement = ({ user, disputes, onCreateDispute, onUpdateDispute }: DisputeManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDispute, setNewDispute] = useState({
    type: 'customer' as const,
    targetId: '',
    targetName: '',
    reason: '',
    description: '',
    assignedTo: '',
    priority: 'medium' as const
  });

  const filteredDisputes = disputes.filter(dispute => {
    const matchesSearch = dispute.targetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dispute.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || dispute.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Dispute['status']) => {
    const statusConfig = {
      open: { label: 'Open', variant: 'destructive' as const, icon: AlertTriangle },
      in_progress: { label: 'In Progress', variant: 'secondary' as const, icon: Clock },
      resolved: { label: 'Resolved', variant: 'default' as const, icon: CheckCircle },
      closed: { label: 'Closed', variant: 'outline' as const, icon: XCircle }
    };
    
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: Dispute['priority']) => {
    const priorityConfig = {
      low: { label: 'Low', className: 'bg-blue-100 text-blue-800' },
      medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800' },
      high: { label: 'High', className: 'bg-orange-100 text-orange-800' },
      urgent: { label: 'Urgent', className: 'bg-red-100 text-red-800' }
    };
    
    const config = priorityConfig[priority];
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const handleCreateDispute = () => {
    if (!newDispute.targetId || !newDispute.targetName || !newDispute.reason || !newDispute.assignedTo) {
      return;
    }

    onCreateDispute({
      ...newDispute,
      assignedBy: user.id,
      status: 'open'
    });

    setNewDispute({
      type: 'customer',
      targetId: '',
      targetName: '',
      reason: '',
      description: '',
      assignedTo: '',
      priority: 'medium'
    });
    setShowCreateDialog(false);
  };

  if (user.role !== 'superuser') {
    return (
      <div className="text-center py-12">
        <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">Only superusers can manage disputes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dispute Management</h2>
          <p className="text-gray-600">Assign and track customer, product, and category disputes</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Dispute
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Dispute</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Dispute Type</Label>
                <Select value={newDispute.type} onValueChange={(value: any) => setNewDispute({...newDispute, type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer Issue</SelectItem>
                    <SelectItem value="specific_product">Specific Product</SelectItem>
                    <SelectItem value="product_category">Product Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Target ID</Label>
                <Input
                  value={newDispute.targetId}
                  onChange={(e) => setNewDispute({...newDispute, targetId: e.target.value})}
                  placeholder="Customer ID, Product ID, or Category ID"
                />
              </div>

              <div>
                <Label>Target Name</Label>
                <Input
                  value={newDispute.targetName}
                  onChange={(e) => setNewDispute({...newDispute, targetName: e.target.value})}
                  placeholder="Customer name, Product name, or Category name"
                />
              </div>

              <div>
                <Label>Reason</Label>
                <Input
                  value={newDispute.reason}
                  onChange={(e) => setNewDispute({...newDispute, reason: e.target.value})}
                  placeholder="Brief reason for dispute"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={newDispute.description}
                  onChange={(e) => setNewDispute({...newDispute, description: e.target.value})}
                  placeholder="Detailed description of the issue"
                  rows={3}
                />
              </div>

              <div>
                <Label>Assign To (User ID)</Label>
                <Input
                  value={newDispute.assignedTo}
                  onChange={(e) => setNewDispute({...newDispute, assignedTo: e.target.value})}
                  placeholder="User ID to assign this dispute to"
                />
              </div>

              <div>
                <Label>Priority</Label>
                <Select value={newDispute.priority} onValueChange={(value: any) => setNewDispute({...newDispute, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateDispute} className="flex-1">
                  Create Dispute
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search disputes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Disputes List */}
      <div className="space-y-4">
        {filteredDisputes.map((dispute) => (
          <Card key={dispute.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    {dispute.id}
                    {getStatusBadge(dispute.status)}
                    {getPriorityBadge(dispute.priority)}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {dispute.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}: {dispute.targetName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    Assigned to: {dispute.assignedTo}
                  </p>
                  <p className="text-xs text-gray-500">
                    By: {dispute.assignedBy}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-gray-700">Reason:</h4>
                  <p className="text-sm">{dispute.reason}</p>
                </div>
                
                {dispute.description && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Description:</h4>
                    <p className="text-sm text-gray-600">{dispute.description}</p>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t">
                  <div className="text-xs text-gray-500">
                    Created: {dispute.createdAt.toLocaleDateString()}
                    {dispute.updatedAt.getTime() !== dispute.createdAt.getTime() && (
                      <span> • Updated: {dispute.updatedAt.toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {dispute.status !== 'closed' && (
                      <>
                        <Select
                          value={dispute.status}
                          onValueChange={(value) => onUpdateDispute(dispute.id, { status: value as any, updatedAt: new Date() })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDisputes.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No disputes found</h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'No disputes have been created yet'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default DisputeManagement;
