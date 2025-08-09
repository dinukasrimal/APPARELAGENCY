import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Percent, 
  Edit, 
  Save, 
  X, 
  Plus, 
  Building2, 
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Agency {
  id: string;
  name: string;
}

interface AgencyDiscountLimit {
  id: string;
  agency_id: string;
  max_discount_percentage: number;
  assigned_by: string;
  assigned_at: string;
  updated_at: string;
  is_active: boolean;
  notes?: string;
  agencies: {
    name: string;
  };
}

const DiscountManagement: React.FC = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [discountLimits, setDiscountLimits] = useState<AgencyDiscountLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgencies();
    fetchDiscountLimits();
  }, []);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agencies',
        variant: 'destructive',
      });
    }
  };

  const fetchDiscountLimits = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_discount_limits')
        .select(`
          *,
          agencies (
            name
          )
        `)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDiscountLimits(data || []);
    } catch (error) {
      console.error('Error fetching discount limits:', error);
      toast({
        title: 'Error',
        description: 'Failed to load discount limits',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAgency || !discountPercentage) {
      toast({
        title: 'Validation Error',
        description: 'Please select an agency and enter a discount percentage',
        variant: 'destructive',
      });
      return;
    }

    const percentage = parseFloat(discountPercentage);
    if (percentage < 0 || percentage > 100) {
      toast({
        title: 'Validation Error',
        description: 'Discount percentage must be between 0 and 100',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // First, deactivate any existing discount limit for this agency
      await supabase
        .from('agency_discount_limits')
        .update({ is_active: false })
        .eq('agency_id', selectedAgency)
        .eq('is_active', true);

      // Then create new discount limit
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('agency_discount_limits')
        .insert({
          agency_id: selectedAgency,
          max_discount_percentage: percentage,
          assigned_by: userData.user?.id,
          notes: notes.trim() || null,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Discount limit assigned successfully',
      });

      // Reset form
      setSelectedAgency('');
      setDiscountPercentage('');
      setNotes('');
      setIsDialogOpen(false);
      
      // Refresh data
      fetchDiscountLimits();
    } catch (error) {
      console.error('Error saving discount limit:', error);
      toast({
        title: 'Error',
        description: 'Failed to save discount limit',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string, newPercentage: number, newNotes?: string) => {
    if (newPercentage < 0 || newPercentage > 100) {
      toast({
        title: 'Validation Error',
        description: 'Discount percentage must be between 0 and 100',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agency_discount_limits')
        .update({ 
          max_discount_percentage: newPercentage,
          notes: newNotes?.trim() || null 
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Discount limit updated successfully',
      });

      setEditingId(null);
      fetchDiscountLimits();
    } catch (error) {
      console.error('Error updating discount limit:', error);
      toast({
        title: 'Error',
        description: 'Failed to update discount limit',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('agency_discount_limits')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Discount limit deactivated successfully',
      });

      fetchDiscountLimits();
    } catch (error) {
      console.error('Error deactivating discount limit:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate discount limit',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getAvailableAgencies = () => {
    const assignedAgencyIds = discountLimits.map(limit => limit.agency_id);
    return agencies.filter(agency => !assignedAgencyIds.includes(agency.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading discount management...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Discount Management</h2>
          <p className="text-muted-foreground">
            Assign maximum discount percentages to agencies
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Assign Discount Limit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Discount Limit</DialogTitle>
              <DialogDescription>
                Set the maximum discount percentage that an agency can apply without requiring superuser approval.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="agency">Agency</Label>
                <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableAgencies().map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4" />
                          <span>{agency.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="percentage">Maximum Discount Percentage</Label>
                <div className="relative">
                  <Input
                    id="percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    placeholder="0.00"
                    className="pr-8"
                  />
                  <Percent className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for this discount limit..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Assigning...' : 'Assign Limit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Discount Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Percent className="w-5 h-5" />
            <span>Current Discount Limits</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {discountLimits.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No discount limits assigned</h3>
              <p className="text-gray-500">Start by assigning discount limits to agencies.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Max Discount %</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountLimits.map((limit) => (
                  <TableRow key={limit.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{limit.agencies.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingId === limit.id ? (
                        <div className="relative w-24">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            defaultValue={limit.max_discount_percentage}
                            className="pr-6"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newValue = parseFloat((e.target as HTMLInputElement).value);
                                handleEdit(limit.id, newValue, limit.notes);
                              } else if (e.key === 'Escape') {
                                setEditingId(null);
                              }
                            }}
                          />
                          <Percent className="absolute right-1 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-sm">
                          {limit.max_discount_percentage}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(limit.assigned_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="text-sm text-gray-600 truncate">
                        {limit.notes || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {editingId === limit.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const input = document.querySelector(`input[defaultValue="${limit.max_discount_percentage}"]`) as HTMLInputElement;
                                if (input) {
                                  const newValue = parseFloat(input.value);
                                  handleEdit(limit.id, newValue, limit.notes);
                                }
                              }}
                              disabled={saving}
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(limit.id)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeactivate(limit.id)}
                              disabled={saving}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> When agencies create sales orders with discounts exceeding their assigned limit, 
          the order will require superuser approval before processing. This helps maintain pricing control while 
          allowing agencies flexibility within approved ranges.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default DiscountManagement;