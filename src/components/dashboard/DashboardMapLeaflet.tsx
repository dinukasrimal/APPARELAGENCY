import { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, Calendar, Users, ShoppingCart, Receipt, AlertTriangle, ChevronDown, ChevronRight, Filter, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllSupabaseRows } from '@/utils/supabasePagination';
import { isWithinSriLanka } from '@/utils/geoBounds';
import LeafletMap from './LeafletMap';

interface LocationData {
  id: string;
  type: 'customer' | 'non_productive' | 'sales_order' | 'invoice' | 'collection';
  name: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  details?: string;
  agencyName?: string;
  color?: string;
  label?: string;
}

interface Agency {
  id: string;
  name: string;
}

interface DashboardMapLeafletProps {
  user: User;
}

// Distinct colours for agencies on the map.
const AGENCY_COLORS = [
  '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777',
  '#0891B2', '#CA8A04', '#4F46E5', '#EA580C', '#16A34A', '#9333EA',
  '#0D9488', '#E11D48', '#65A30D', '#F59E0B', '#3B82F6', '#10B981',
];

// Compact money format for the amount shown inside a pin (e.g. 12,500 -> 12.5k).
const formatCompact = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'k';
  return String(Math.round(n));
};

const DashboardMapLeaflet = ({ user }: DashboardMapLeafletProps) => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  // Map shows only customers by default (all time); the user can switch on
  // sales orders / invoices / collections / non-productive visits via the filter.
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['customer']);
  // Customer scope for the map: 'active' = customers invoiced in the last 90 days
  // (default), 'all' = every customer.
  const [customerScope, setCustomerScope] = useState<'active' | 'all'>('active');
  // Live "my location" (GPS)
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const [showDistricts, setShowDistricts] = useState(false);
  
  // Separate filters for the list
  const [listStartDate, setListStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [listEndDate, setListEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [listSelectedTypes, setListSelectedTypes] = useState<string[]>(['customer', 'non_productive', 'sales_order', 'invoice']);
  
  const [loading, setLoading] = useState(true);
  const [openAgencies, setOpenAgencies] = useState<string[]>([]);

  // Stable agency -> colour mapping (by name order so colours don't shuffle).
  const agencyColorMap = useMemo(() => {
    const m = new Map<string, string>();
    [...agencies]
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach((a, i) => m.set(a.id, AGENCY_COLORS[i % AGENCY_COLORS.length]));
    return m;
  }, [agencies]);
  const [showFilters, setShowFilters] = useState(false);
  const [showListFilters, setShowListFilters] = useState(false);
  const [openDateGroups, setOpenDateGroups] = useState<string[]>([]);

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
  }, [startDate, endDate, selectedTypes, selectedAgencies, customerScope]);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setAgencies(data || []);
      
      // If superuser, select all agencies by default
      if (user.role === 'superuser' && data && data.length > 0) {
        setSelectedAgencies(data.map(agency => agency.id));
      }
    } catch (error) {
      console.error('Error fetching agencies:', error);
    }
  };

  // Live location: toggle GPS tracking. First fix pans/zooms the map to you;
  // subsequent updates keep the "you are here" marker current.
  const toggleLiveLocation = () => {
    if (myLocation || watchIdRef.current !== null) {
      // Turn off
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      setMyLocation(null);
      setLocating(false);
      return;
    }

    if (!navigator.geolocation) {
      alert('Location is not supported by this browser.');
      return;
    }

    setLocating(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocating(false);
        setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        watchIdRef.current = null;
        alert(err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Enable it in your browser settings.'
          : 'Could not get your location.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  // Clean up the geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

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
      
      // Fetch customer locations - NO DATE FILTERING
      if (selectedTypes.includes('customer')) {
        console.log('Fetching customers for agencies:', selectedAgencies);

        // Last-90-day invoice totals per customer (for the amount shown in the
        // pin) + the active set (for the Active scope). One query, reused.
        const window90Start = new Date();
        window90Start.setDate(window90Start.getDate() - 90);
        const recentInvoices = await fetchAllSupabaseRows<{ customer_id: string | null; customer_name: string | null; total: number | null; agency_id: string | null }>(() =>
          supabase
            .from('invoices')
            .select('customer_id, customer_name, total, agency_id')
            .in('agency_id', selectedAgencies)
            .gte('created_at', window90Start.toISOString())
        );
        // Sum by customer_id, and a name fallback SCOPED to the agency so a
        // customer isn't credited with a same-named customer's invoices from a
        // different agency (e.g. "Gayan tex" exists under several agencies).
        const sumById = new Map<string, number>();
        const sumByAgencyName = new Map<string, number>();
        recentInvoices.forEach(inv => {
          const amt = Number(inv.total || 0);
          if (inv.customer_id) sumById.set(inv.customer_id, (sumById.get(inv.customer_id) || 0) + amt);
          const nm = (inv.customer_name || '').toLowerCase().trim();
          if (nm && inv.agency_id) {
            const key = `${inv.agency_id}:${nm}`;
            sumByAgencyName.set(key, (sumByAgencyName.get(key) || 0) + amt);
          }
        });

        // Paginate — a plain query caps at 1000 rows, dropping some agencies'
        // customers when "all agencies" is selected.
        const customers = await fetchAllSupabaseRows<{ id: string; name: string; latitude: number; longitude: number; created_at: string; agency_id: string }>(() =>
          supabase
            .from('customers')
            .select('id, name, latitude, longitude, created_at, agency_id')
            .in('agency_id', selectedAgencies)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
        );

        {
          console.log('Fetched customers:', customers.length);

          customers?.forEach(customer => {
            const nm = (customer.name || '').toLowerCase().trim();
            // Prefer customer_id; fall back to name ONLY within the same agency.
            const amount90 = sumById.get(customer.id)
              ?? sumByAgencyName.get(`${customer.agency_id}:${nm}`)
              ?? 0;

            // Active-scope filter: keep only customers invoiced in last 90 days
            if (customerScope === 'active' && amount90 <= 0) return;

            const agency = agencies.find(a => a.id === customer.agency_id);
            locations.push({
              id: customer.id,
              type: 'customer',
              name: customer.name,
              latitude: customer.latitude,
              longitude: customer.longitude,
              timestamp: new Date(customer.created_at),
              agencyName: agency?.name || 'Unknown Agency',
              color: agencyColorMap.get(customer.agency_id) || '#EAB308',
              label: amount90 > 0 ? formatCompact(amount90) : undefined,
              details: `Last 90 days invoices: LKR ${amount90.toLocaleString()}`,
            });
          });
        }
      }

      // Fetch non-productive visits - WITH DATE FILTERING
      if (selectedTypes.includes('non_productive')) {
        const { data: visits, error } = await supabase
          .from('non_productive_visits')
          .select('id, reason, latitude, longitude, created_at, agency_id')
          .in('agency_id', selectedAgencies)
          .gte('created_at', dbStartDate)
          .lte('created_at', dbEndDate);
        
        if (error) {
          console.error('Error fetching non-productive visits:', error);
        } else {
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
      }

      // Fetch sales order locations - WITH DATE FILTERING
      if (selectedTypes.includes('sales_order')) {
        const { data: orders, error } = await supabase
          .from('sales_orders')
          .select('id, customer_name, latitude, longitude, created_at, agency_id')
          .in('agency_id', selectedAgencies)
          .gte('created_at', dbStartDate)
          .lte('created_at', dbEndDate)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);
        
        if (error) {
          console.error('Error fetching sales orders:', error);
        } else {
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
      }

      // Fetch invoice locations - WITH DATE FILTERING
      if (selectedTypes.includes('invoice')) {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('id, customer_name, latitude, longitude, created_at, agency_id')
          .in('agency_id', selectedAgencies)
          .gte('created_at', dbStartDate)
          .lte('created_at', dbEndDate)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);
        
        if (error) {
          console.error('Error fetching invoices:', error);
        } else {
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
      }

      // Fetch collection locations - WITH DATE FILTERING
      if (selectedTypes.includes('collection')) {
        const { data: collections, error } = await supabase
          .from('collections')
          .select('id, customer_name, latitude, longitude, created_at, agency_id, total_amount, payment_method')
          .in('agency_id', selectedAgencies)
          .gte('created_at', dbStartDate)
          .lte('created_at', dbEndDate)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);
        
        if (error) {
          console.error('Error fetching collections:', error);
        } else {
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
      }

      console.log('Final locations data:', locations);
      // Hide any points outside Sri Lanka (bad GPS fixes).
      setLocations(locations.filter(l => isWithinSriLanka(l.latitude, l.longitude)));
    } catch (error) {
      console.error('Error fetching location data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationColor = (type: string) => {
    switch (type) {
      case 'customer': return '#EAB308';
      case 'non_productive': return '#EF4444';
      case 'sales_order': return '#000000';
      case 'invoice': return '#22C55E';
      case 'collection': return '#8B5CF6'; // Purple color for collections
      default: return '#6B7280';
    }
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'customer': return Users;
      case 'non_productive': return AlertTriangle;
      case 'sales_order': return ShoppingCart;
      case 'invoice': return Receipt;
      case 'collection': return DollarSign;
      default: return MapPin;
    }
  };

  const toggleLocationType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleListLocationType = (type: string) => {
    setListSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleAgency = (agencyId: string) => {
    setSelectedAgencies(prev => 
      prev.includes(agencyId) 
        ? prev.filter(id => id !== agencyId)
        : [...prev, agencyId]
    );
  };

  const toggleAgencyCollapse = (agencyId: string) => {
    setOpenAgencies(prev => 
      prev.includes(agencyId) 
        ? prev.filter(id => id !== agencyId)
        : [...prev, agencyId]
    );
  };

  const toggleDateGroupCollapse = (dateKey: string) => {
    setOpenDateGroups(prev => 
      prev.includes(dateKey) 
        ? prev.filter(id => id !== dateKey)
        : [...prev, dateKey]
    );
  };

  const selectAllAgencies = () => {
    setSelectedAgencies(agencies.map(agency => agency.id));
  };

  const deselectAllAgencies = () => {
    setSelectedAgencies([]);
  };

  const selectAllTypes = () => {
    setSelectedTypes(['customer', 'non_productive', 'sales_order', 'invoice', 'collection']);
  };

  const deselectAllTypes = () => {
    setSelectedTypes([]);
  };

  const selectAllListTypes = () => {
    setListSelectedTypes(['customer', 'non_productive', 'sales_order', 'invoice']);
  };

  const deselectAllListTypes = () => {
    setListSelectedTypes([]);
  };

  const locationTypeLabels = {
    customer: 'Customers (All Time)',
    non_productive: 'Non-productive Visits', 
    sales_order: 'Sales Orders',
    invoice: 'Invoices',
    collection: 'Collections'
  };

  // Filter locations for the list based on list filters
  const getFilteredListLocations = () => {
    return locations.filter(location => {
      // Type filter
      if (!listSelectedTypes.includes(location.type)) return false;
      
      // Date filter - apply to ALL types for the list view
      const locationDate = location.timestamp.toISOString().split('T')[0];
      if (locationDate < listStartDate || locationDate > listEndDate) return false;
      
      return true;
    });
  };

  // Group filtered locations by year/month/day
  const getGroupedListLocations = () => {
    const filteredLocations = getFilteredListLocations();
    const grouped: Record<string, LocationData[]> = {};
    
    filteredLocations.forEach(location => {
      const date = location.timestamp;
      const year = date.getFullYear();
      const month = date.toLocaleString('default', { month: 'long' });
      const day = date.getDate();
      const dateKey = `${year}-${month}-${day}`;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(location);
    });
    
    return grouped;
  };

  const groupedListLocations = getGroupedListLocations();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Location Map - Interactive View
        </h3>
        
        {/* Map Filter Toggle */}
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? 'Hide Map Filters' : 'Show Map Filters'}
          </Button>
        </div>

        {/* Collapsible Map Filters */}
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent className="space-y-4 mb-6">
            {/* Date Range */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">Date Range (for visits, orders & invoices):</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
                <span className="text-sm text-gray-500">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>

            {/* Agency Selection for Super Users */}
            {user.role === 'superuser' && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Agencies:</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllAgencies}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllAgencies}>
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {agencies.map((agency) => (
                    <button
                      key={agency.id}
                      onClick={() => toggleAgency(agency.id)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-md border text-sm transition-colors ${
                        selectedAgencies.includes(agency.id)
                          ? 'bg-blue-50 border-blue-200 text-blue-700' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {agency.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Location Type Filters */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Location Types:</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllTypes}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllTypes}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(locationTypeLabels).map(([type, label]) => {
                  const Icon = getLocationIcon(type);
                  const isSelected = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleLocationType(type)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md border transition-colors ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-200 text-blue-700' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: getLocationColor(type) }}></div>
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Map */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Map ({locations.length} locations)
              {selectedAgencies.length > 1 && (
                <Badge variant="secondary">
                  {selectedAgencies.length} agencies
                </Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* My live location */}
              <Button
                type="button"
                size="sm"
                variant={myLocation ? 'default' : 'outline'}
                onClick={toggleLiveLocation}
                className="flex items-center gap-1"
              >
                <MapPin className="h-4 w-4" />
                {locating ? 'Locating…' : myLocation ? 'Stop' : 'My Location'}
              </Button>

              {/* Sri Lanka districts overlay toggle */}
              <Button
                type="button"
                size="sm"
                variant={showDistricts ? 'default' : 'outline'}
                onClick={() => setShowDistricts(v => !v)}
              >
                Districts
              </Button>

              {/* Active / All customer scope toggle */}
              <div className="inline-flex rounded-lg border bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setCustomerScope('active')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    customerScope === 'active' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerScope('all')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    customerScope === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {customerScope === 'active'
              ? 'Showing active customers (invoiced in the last 90 days).'
              : 'Showing all customers.'}
          </p>
        </CardHeader>
        <CardContent>
          <LeafletMap locations={locations} height="500px" myLocation={myLocation} showDistricts={showDistricts} />

          {/* Agency colour legend */}
          {selectedTypes.includes('customer') && selectedAgencies.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Agency colours — the number inside a pin is that customer's last-90-day invoice total:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {[...agencies]
                  .filter(a => selectedAgencies.includes(a.id))
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map(a => (
                    <div key={a.id} className="flex items-center gap-2">
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-white shadow"
                        style={{ backgroundColor: agencyColorMap.get(a.id) || '#EAB308' }}
                      />
                      <span className="text-sm text-gray-700">{a.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location Details List with Separate Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Location Details by Date
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowListFilters(!showListFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {showListFilters ? 'Hide List Filters' : 'Show List Filters'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* List Filters */}
          <Collapsible open={showListFilters} onOpenChange={setShowListFilters}>
            <CollapsibleContent className="space-y-4 mb-6">
              {/* List Date Range */}
              <div className="flex flex-wrap items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">List Date Range:</span>
                  <Input
                    type="date"
                    value={listStartDate}
                    onChange={(e) => setListStartDate(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-sm text-blue-700">to</span>
                  <Input
                    type="date"
                    value={listEndDate}
                    onChange={(e) => setListEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
              
              {/* List Location Type Filters */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-blue-900">List Location Types:</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllListTypes}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllListTypes}>
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(locationTypeLabels).map(([type, label]) => {
                    const Icon = getLocationIcon(type);
                    const isSelected = listSelectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleListLocationType(type)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md border transition-colors ${
                          isSelected 
                            ? 'bg-blue-100 border-blue-300 text-blue-800' 
                            : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: getLocationColor(type) }}></div>
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Grouped Location List */}
          {Object.keys(groupedListLocations).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No locations found for the selected criteria
            </div>
          ) : (
            Object.entries(groupedListLocations)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([dateKey, dateLocations]) => (
                <Collapsible
                  key={dateKey}
                  open={openDateGroups.includes(dateKey)}
                  onOpenChange={() => toggleDateGroupCollapse(dateKey)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      {openDateGroups.includes(dateKey) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Calendar className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-900">{dateKey}</span>
                      <Badge variant="secondary" className="bg-green-200 text-green-800">
                        {dateLocations.length} locations
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {dateLocations.map((location) => {
                      const Icon = getLocationIcon(location.type);
                      return (
                        <div
                          key={location.id}
                          className="flex items-center justify-between p-3 bg-white border rounded-lg ml-4"
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: getLocationColor(location.type) }}
                            />
                            <Icon className="h-4 w-4 text-gray-600" />
                            <div>
                              <div className="font-medium">{location.name}</div>
                              <div className="text-sm text-gray-600">{location.agencyName}</div>
                              {location.details && (
                                <div className="text-sm text-gray-600">{location.details}</div>
                              )}
                              <div className="text-xs text-gray-500">
                                {location.timestamp.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">
                            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                          </div>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardMapLeaflet;
