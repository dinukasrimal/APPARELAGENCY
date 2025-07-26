import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Calendar, Users, ShoppingCart, Receipt, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GoogleMapComponent from './GoogleMapComponent';
import GoogleMapsAPIInput from './GoogleMapsAPIInput';
interface LocationData {
  id: string;
  type: 'customer' | 'non_productive' | 'sales_order' | 'invoice' | 'collection';
  name: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  details?: string;
  agencyName?: string;
}
interface Agency {
  id: string;
  name: string;
}
interface DashboardMapProps {
  user: User;
}
const DashboardMap = ({
  user
}: DashboardMapProps) => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['customer', 'non_productive', 'sales_order', 'invoice', 'collection']);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string>('');

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('google_maps_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);
  useEffect(() => {
    if (user.role === 'superuser') {
      fetchAgencies();
    } else {
      setSelectedAgencies([user.agencyId!]);
    }
  }, [user]);
  useEffect(() => {
    if (selectedAgencies.length > 0) {
      fetchLocationData();
    }
  }, [startDate, endDate, selectedTypes, selectedAgencies]);
  const fetchAgencies = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('agencies').select('id, name').order('name');
      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
    }
  };
  const fetchLocationData = async () => {
    try {
      const locations: LocationData[] = [];

      // Convert local dates to UTC for proper database filtering
      const localStartDate = new Date(startDate + 'T00:00:00');
      const localEndDate = new Date(endDate + 'T23:59:59');
      const utcStartDate = new Date(localStartDate.getTime() - localStartDate.getTimezoneOffset() * 60000);
      const utcEndDate = new Date(localEndDate.getTime() - localEndDate.getTimezoneOffset() * 60000);
      
      const dbStartDate = utcStartDate.toISOString();
      const dbEndDate = utcEndDate.toISOString();

      // Fetch customer locations
      if (selectedTypes.includes('customer')) {
        const {
          data: customers
        } = await supabase.from('customers').select('id, name, latitude, longitude, created_at, agency_id').in('agency_id', selectedAgencies).not('latitude', 'is', null).not('longitude', 'is', null);
        customers?.forEach(customer => {
          const agency = agencies.find(a => a.id === customer.agency_id);
          locations.push({
            id: customer.id,
            type: 'customer',
            name: customer.name,
            latitude: customer.latitude,
            longitude: customer.longitude,
            timestamp: new Date(customer.created_at),
            agencyName: agency?.name || 'Unknown Agency'
          });
        });
      }

      // Fetch non-productive visits
      if (selectedTypes.includes('non_productive')) {
        const {
          data: visits
        } = await supabase.from('non_productive_visits').select('id, reason, latitude, longitude, created_at, agency_id').in('agency_id', selectedAgencies).gte('created_at', dbStartDate).lte('created_at', dbEndDate);
        visits?.forEach(visit => {
          const agency = agencies.find(a => a.id === visit.agency_id);
          locations.push({
            id: visit.id,
            type: 'non_productive',
            name: 'Non-productive Visit',
            latitude: visit.latitude,
            longitude: visit.longitude,
            timestamp: new Date(visit.created_at),
            details: visit.reason,
            agencyName: agency?.name || 'Unknown Agency'
          });
        });
      }

      // Fetch sales order locations
      if (selectedTypes.includes('sales_order')) {
        const {
          data: orders
        } = await supabase.from('sales_orders').select('id, customer_name, latitude, longitude, created_at, agency_id').in('agency_id', selectedAgencies).gte('created_at', dbStartDate).lte('created_at', dbEndDate).not('latitude', 'is', null).not('longitude', 'is', null);
        orders?.forEach(order => {
          const agency = agencies.find(a => a.id === order.agency_id);
          locations.push({
            id: order.id,
            type: 'sales_order',
            name: order.customer_name,
            latitude: order.latitude,
            longitude: order.longitude,
            timestamp: new Date(order.created_at),
            details: 'Sales Order',
            agencyName: agency?.name || 'Unknown Agency'
          });
        });
      }

      // Fetch invoice locations
      if (selectedTypes.includes('invoice')) {
        const {
          data: invoices
        } = await supabase.from('invoices').select('id, customer_name, latitude, longitude, created_at, agency_id').in('agency_id', selectedAgencies).gte('created_at', dbStartDate).lte('created_at', dbEndDate).not('latitude', 'is', null).not('longitude', 'is', null);
        invoices?.forEach(invoice => {
          const agency = agencies.find(a => a.id === invoice.agency_id);
          locations.push({
            id: invoice.id,
            type: 'invoice',
            name: invoice.customer_name,
            latitude: invoice.latitude,
            longitude: invoice.longitude,
            timestamp: new Date(invoice.created_at),
            details: 'Invoice',
            agencyName: agency?.name || 'Unknown Agency'
          });
        });
      }

      // Fetch collection locations
      if (selectedTypes.includes('collection')) {
        const {
          data: collections
        } = await supabase.from('collections').select('id, customer_name, latitude, longitude, created_at, agency_id, total_amount, payment_method').in('agency_id', selectedAgencies).gte('created_at', dbStartDate).lte('created_at', dbEndDate).not('latitude', 'is', null).not('longitude', 'is', null);
        collections?.forEach(collection => {
          const agency = agencies.find(a => a.id === collection.agency_id);
          locations.push({
            id: collection.id,
            type: 'collection',
            name: collection.customer_name,
            latitude: collection.latitude,
            longitude: collection.longitude,
            timestamp: new Date(collection.created_at),
            details: `Collection: LKR ${collection.total_amount.toLocaleString()} (${collection.payment_method})`,
            agencyName: agency?.name || 'Unknown Agency'
          });
        });
      }
      setLocations(locations);
    } catch (error) {
      console.error('Error fetching location data:', error);
    } finally {
      setLoading(false);
    }
  };
  const getLocationColor = (type: string) => {
    switch (type) {
      case 'customer':
        return 'bg-yellow-500';
      case 'non_productive':
        return 'bg-red-500';
      case 'sales_order':
        return 'bg-black';
      case 'invoice':
        return 'bg-green-500';
      case 'collection':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };
  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'customer':
        return Users;
      case 'non_productive':
        return AlertTriangle;
      case 'sales_order':
        return ShoppingCart;
      case 'invoice':
        return Receipt;
      case 'collection':
        return MapPin;
      default:
        return MapPin;
    }
  };
  const toggleLocationType = (type: string) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };
  const toggleAgency = (agencyId: string) => {
    setSelectedAgencies(prev => prev.includes(agencyId) ? prev.filter(id => id !== agencyId) : [...prev, agencyId]);
  };
  const locationTypeLabels = {
    customer: 'Customers',
    non_productive: 'Non-productive Visits',
    sales_order: 'Sales Orders',
    invoice: 'Invoices',
    collection: 'Collections'
  };

  // Group locations by agency for display
  const locationsByAgency = locations.reduce((acc, location) => {
    const agency = location.agencyName || 'Unknown';
    if (!acc[agency]) acc[agency] = [];
    acc[agency].push(location);
    return acc;
  }, {} as Record<string, LocationData[]>);
  return <div className="space-y-6">
      

      {/* Google Map */}
      <Card>
        
        
      </Card>

      {/* Location List by Agency */}
      <Card>
        
        
      </Card>
    </div>;
};
export default DashboardMap;