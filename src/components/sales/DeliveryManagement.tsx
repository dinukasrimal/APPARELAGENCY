import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Delivery, Invoice } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Truck, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  XCircle,
  Package
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import DeliveryDetails from './DeliveryDetails';

interface DeliveryManagementProps {
  user: User;
  deliveries: Delivery[];
  invoices: Invoice[];
  onRefresh: () => void;
}

const DeliveryManagement = ({ user, deliveries, invoices, onRefresh }: DeliveryManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'out_for_delivery' | 'delivered' | 'failed'>('all');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  // Filter deliveries based on search term, status, and user role
  const filteredDeliveries = deliveries.filter(delivery => {
    const invoice = invoices.find(inv => inv.id === delivery.invoiceId);
    const matchesSearch = 
      (invoice?.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      delivery.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (delivery.receivedByName?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || delivery.status === statusFilter;
    
    // Role-based filtering
    const matchesRole = 
      user.role === 'superuser' ||
      delivery.agencyId === user.agencyId ||
      delivery.deliveryAgentId === user.id;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const getStatusBadge = (status: Delivery['status']) => {
    const configs = {
      pending: { variant: 'secondary', icon: Clock, label: 'Pending', color: 'text-yellow-600' },
      out_for_delivery: { variant: 'default', icon: Truck, label: 'Out for Delivery', color: 'text-blue-600' },
      delivered: { variant: 'default', icon: CheckCircle, label: 'Delivered', color: 'text-green-600' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed', color: 'text-red-600' },
      cancelled: { variant: 'destructive', icon: XCircle, label: 'Cancelled', color: 'text-gray-600' }
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleMarkOutForDelivery = async (deliveryId: string) => {
    setUpdating(deliveryId);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ 
          status: 'out_for_delivery',
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Delivery marked as out for delivery',
      });
      
      onRefresh();
    } catch (error) {
      console.error('Error updating delivery:', error);
      toast({
        title: 'Error',
        description: 'Failed to update delivery status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleMarkFailed = async (deliveryId: string) => {
    setUpdating(deliveryId);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryId);

      if (error) throw error;

      toast({
        title: 'Delivery Marked as Failed',
        description: 'Delivery has been marked as failed',
        variant: 'destructive',
      });
      
      onRefresh();
    } catch (error) {
      console.error('Error updating delivery:', error);
      toast({
        title: 'Error',
        description: 'Failed to update delivery status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  if (selectedDelivery) {
    return (
      <DeliveryDetails
        delivery={selectedDelivery}
        invoice={invoices.find(inv => inv.id === selectedDelivery.invoiceId)}
        user={user}
        onBack={() => setSelectedDelivery(null)}
        onSuccess={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by customer name, delivery ID, or receiver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'out_for_delivery', label: 'Out for Delivery' },
            { key: 'delivered', label: 'Delivered' },
            { key: 'failed', label: 'Failed' }
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(key as any)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Delivery Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { status: 'pending', label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
          { status: 'out_for_delivery', label: 'Out for Delivery', color: 'text-blue-600', bgColor: 'bg-blue-50' },
          { status: 'delivered', label: 'Delivered', color: 'text-green-600', bgColor: 'bg-green-50' },
          { status: 'failed', label: 'Failed', color: 'text-red-600', bgColor: 'bg-red-50' },
          { status: 'cancelled', label: 'Cancelled', color: 'text-gray-600', bgColor: 'bg-gray-50' }
        ].map(({ status, label, color, bgColor }) => {
          const count = filteredDeliveries.filter(d => d.status === status).length;
          return (
            <Card key={status} className={`${bgColor} border-0`}>
              <CardContent className="p-4">
                <div className={`text-2xl font-bold ${color}`}>{count}</div>
                <div className="text-sm text-gray-600">{label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Deliveries List */}
      {filteredDeliveries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries found</h3>
            <p className="text-gray-600">
              {searchTerm 
                ? 'Try adjusting your search criteria'
                : statusFilter !== 'all' 
                  ? `No ${statusFilter.replace('_', ' ')} deliveries`
                  : 'No deliveries have been created yet'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDeliveries.map((delivery) => {
            const invoice = invoices.find(inv => inv.id === delivery.invoiceId);
            return (
              <Card key={delivery.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-gray-900">
                          {invoice?.customerName || 'Unknown Customer'}
                        </h3>
                        {getStatusBadge(delivery.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">LKR {invoice?.total.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          {delivery.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Invoice: #{invoice?.invoiceNumber}</p>
                      <p>Delivery ID: {delivery.id.substring(0, 8)}...</p>
                      {delivery.scheduledDate && (
                        <p className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled: {delivery.scheduledDate.toLocaleDateString()}
                        </p>
                      )}
                      {delivery.deliveredAt && (
                        <p className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Delivered: {delivery.deliveredAt.toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedDelivery(delivery)}
                      >
                        View Details
                      </Button>
                      
                      {delivery.status === 'pending' && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleMarkOutForDelivery(delivery.id)}
                          disabled={updating === delivery.id}
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          {updating === delivery.id ? 'Updating...' : 'Mark Out for Delivery'}
                        </Button>
                      )}
                      
                      {delivery.status === 'out_for_delivery' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleMarkFailed(delivery.id)}
                          disabled={updating === delivery.id}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          {updating === delivery.id ? 'Updating...' : 'Mark Failed'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeliveryManagement;