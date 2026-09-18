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
import { loadDistrictFeatures, districtForPoint } from '@/utils/districtLookup';
import LeafletMap from './LeafletMap';
import { useToast } from '@/hooks/use-toast';
import { LocationService } from '@/services/location.service';
import { Capacitor } from '@capacitor/core';

// How long to wait for a GPS fix before giving up and telling the user.
const LOCATE_TIMEOUT_MS = 15000;
// How long to wait for an agent's app to answer a location check. Long enough
// for a GPS fix on the phone plus the round trip; after that the app is
// presumably closed, so fall back to the last known location.
const AGENT_LOCATE_TIMEOUT_MS = 45000;

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
  const watchIdRef = useRef<string | null>(null);
  const locateTimeoutRef = useRef<number | null>(null);
  // Bumped on every stop so a permission prompt answered late can't revive a
  // cancelled attempt.
  const locateAttemptRef = useRef(0);
  // Superuser "Locate agent": on-demand check, answered by the agent's open app
  const [agentOptions, setAgentOptions] = useState<Array<{ id: string; name: string; agencyName: string | null }>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [locatingAgent, setLocatingAgent] = useState(false);
  const [agentLocation, setAgentLocation] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const agentRequestCleanupRef = useRef<(() => void) | null>(null);
  const [showDistricts, setShowDistricts] = useState(false);
  // District-wise sales (last 90 days, from invoices mapped by GPS to a district)
  const [districtSales, setDistrictSales] = useState<Array<{ district: string; total: number; count: number }>>([]);
  const [districtSalesTotal, setDistrictSalesTotal] = useState(0);
  const [districtSalesLoading, setDistrictSalesLoading] = useState(false);
  
  // Separate filters for the list
  const [listStartDate, setListStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [listEndDate, setListEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [listSelectedTypes, setListSelectedTypes] = useState<string[]>(['customer', 'non_productive', 'sales_order', 'invoice']);
  
  const [loading, setLoading] = useState(true);
  const [openAgencies, setOpenAgencies] = useState<string[]>([]);
  const { toast } = useToast();

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
      fetchAgentOptions();
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

  const fetchAgentOptions = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, agency_name, role')
      .neq('role', 'superuser')
      .order('name');
    if (error) {
      console.error('Error fetching agents:', error);
      return;
    }
    setAgentOptions((data || []).map((p) => ({ id: p.id, name: p.name, agencyName: p.agency_name })));
  };

  // Popup labels are HTML, so names from profiles must not be able to inject markup.
  const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const timeAgo = (at: Date) => {
    const mins = Math.round((Date.now() - at.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours} h ago`;
    return at.toLocaleDateString();
  };

  // Where the agent last did something GPS-stamped. Used when their app
  // doesn't answer, which is the normal case whenever it isn't open.
  const fetchLastKnownLocation = async (agentId: string) => {
    const sources: Array<{ label: string; query: PromiseLike<{ data: any[] | null }> ; lat: string; lng: string; at: string }> = [
      { label: 'invoice', lat: 'latitude', lng: 'longitude', at: 'created_at',
        query: supabase.from('invoices').select('latitude, longitude, created_at').eq('created_by', agentId)
          .not('latitude', 'is', null).order('created_at', { ascending: false }).limit(1) },
      { label: 'sales order', lat: 'latitude', lng: 'longitude', at: 'created_at',
        query: supabase.from('sales_orders').select('latitude, longitude, created_at').eq('created_by', agentId)
          .not('latitude', 'is', null).order('created_at', { ascending: false }).limit(1) },
      { label: 'collection', lat: 'latitude', lng: 'longitude', at: 'created_at',
        query: supabase.from('collections').select('latitude, longitude, created_at').eq('created_by', agentId)
          .not('latitude', 'is', null).order('created_at', { ascending: false }).limit(1) },
      { label: 'visit', lat: 'latitude', lng: 'longitude', at: 'created_at',
        query: supabase.from('non_productive_visits').select('latitude, longitude, created_at').eq('user_id', agentId)
          .not('latitude', 'is', null).order('created_at', { ascending: false }).limit(1) },
      { label: 'clock-in', lat: 'clock_in_latitude', lng: 'clock_in_longitude', at: 'clock_in_time',
        query: supabase.from('time_tracking').select('clock_in_latitude, clock_in_longitude, clock_in_time').eq('user_id', agentId)
          .not('clock_in_latitude', 'is', null).order('clock_in_time', { ascending: false }).limit(1) },
    ];

    const results = await Promise.all(sources.map((s) => s.query));
    let best: { latitude: number; longitude: number; at: Date; source: string } | null = null;
    results.forEach((res, i) => {
      const row = res.data?.[0];
      if (!row) return;
      const src = sources[i];
      const latitude = Number(row[src.lat]);
      const longitude = Number(row[src.lng]);
      // 0,0 is what the forms save when GPS failed — not a real place.
      if (!latitude || !longitude) return;
      const at = new Date(row[src.at]);
      if (!best || at > best.at) best = { latitude, longitude, at, source: src.label };
    });
    return best as { latitude: number; longitude: number; at: Date; source: string } | null;
  };

  const locateAgent = async () => {
    const agent = agentOptions.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    agentRequestCleanupRef.current?.();
    setLocatingAgent(true);
    setAgentLocation(null);

    const { data: request, error } = await supabase
      .from('location_requests')
      .insert({ target_user_id: agent.id, requested_by: user.id })
      .select('id')
      .single();

    if (error || !request) {
      setLocatingAgent(false);
      toast({ title: 'Could not send location check', description: error?.message || 'Please try again.', variant: 'destructive' });
      return;
    }

    let settled = false;

    const fallBackToLastKnown = async (reason: string) => {
      const last = await fetchLastKnownLocation(agent.id);
      setLocatingAgent(false);
      if (last) {
        setAgentLocation({
          latitude: last.latitude,
          longitude: last.longitude,
          label: `<b>${escapeHtml(agent.name)}</b><br/>Last known · ${last.source}<br/>${timeAgo(last.at)}`,
        });
        toast({ title: `${agent.name}: showing last known location`, description: `${reason} Last seen at a ${last.source}, ${timeAgo(last.at)}.` });
      } else {
        toast({ title: `Could not locate ${agent.name}`, description: `${reason} No earlier GPS-stamped activity either.`, variant: 'destructive' });
      }
    };

    const finish = () => {
      settled = true;
      window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
      agentRequestCleanupRef.current = null;
    };

    const channel = supabase
      .channel(`location-request-${request.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'location_requests', filter: `id=eq.${request.id}` },
        (payload) => {
          if (settled) return;
          const row = payload.new as { status: string; latitude: number | null; longitude: number | null; accuracy: number | null; error: string | null };
          if (row.status === 'fulfilled' && row.latitude && row.longitude) {
            finish();
            setLocatingAgent(false);
            const accuracy = row.accuracy ? ` · ±${Math.round(row.accuracy)} m` : '';
            setAgentLocation({
              latitude: row.latitude,
              longitude: row.longitude,
              label: `<b>${escapeHtml(agent.name)}</b><br/>Live · just now${accuracy}`,
            });
            toast({ title: `${agent.name} located`, description: 'Current location from their device.' });
          } else if (row.status === 'failed') {
            finish();
            void fallBackToLastKnown(`Their device couldn't get a GPS fix (${row.error || 'unknown error'}).`);
          }
        }
      )
      .subscribe();

    const timeoutId = window.setTimeout(async () => {
      if (settled) return;
      finish();
      await supabase.from('location_requests').update({ status: 'expired' }).eq('id', request.id).eq('status', 'pending');
      void fallBackToLastKnown('Their app is not open right now, so their phone could not answer.');
    }, AGENT_LOCATE_TIMEOUT_MS);

    agentRequestCleanupRef.current = () => {
      if (settled) return;
      finish();
      setLocatingAgent(false);
    };
  };

  // Drop any in-flight location check if the dashboard is left
  useEffect(() => () => agentRequestCleanupRef.current?.(), []);

  const stopLiveLocation = () => {
    locateAttemptRef.current += 1;
    if (locateTimeoutRef.current !== null) {
      window.clearTimeout(locateTimeoutRef.current);
      locateTimeoutRef.current = null;
    }
    if (watchIdRef.current !== null) {
      LocationService.clearWatch(watchIdRef.current).catch(() => {
        // Watch already gone — nothing to clean up.
      });
    }
    watchIdRef.current = null;
    setLocating(false);
  };

  // Live location: toggle GPS tracking. First fix pans/zooms the map to you;
  // subsequent updates keep the "you are here" marker current.
  //
  // Uses LocationService (the Capacitor plugin) rather than navigator.geolocation:
  // inside the Android/iOS WebView the raw browser API is never granted
  // permission, so it hangs with neither callback firing — the button appeared
  // to do nothing. The plugin asks the OS for permission and falls back to the
  // browser API on the web.
  const toggleLiveLocation = async () => {
    // Treat "still locating" as on, so a second tap cancels a pending attempt
    // rather than appearing to do nothing.
    if (myLocation || watchIdRef.current !== null || locating) {
      stopLiveLocation();
      setMyLocation(null);
      return;
    }

    // In a browser, geolocation only works on a secure origin — over plain
    // HTTP the request is refused, sometimes without any callback. The native
    // app goes through the Capacitor plugin to the OS instead, which has no
    // such requirement, so only check this on the web.
    if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && window.isSecureContext === false) {
      toast({
        title: 'Location needs a secure connection',
        description: 'Open the app over HTTPS (not http://) to use live location.',
        variant: 'destructive',
      });
      return;
    }

    const attempt = locateAttemptRef.current + 1;
    locateAttemptRef.current = attempt;
    const isCurrent = () => locateAttemptRef.current === attempt;

    setLocating(true);

    // Never leave the button stuck on "Locating…" with no explanation.
    locateTimeoutRef.current = window.setTimeout(() => {
      if (!isCurrent()) return;
      stopLiveLocation();
      toast({
        title: 'Could not get your location',
        description: 'No response from the device. Check that location services are on and this app is allowed to use them.',
        variant: 'destructive',
      });
    }, LOCATE_TIMEOUT_MS);

    const reportFailure = (error: unknown) => {
      stopLiveLocation();
      const message = error instanceof Error ? error.message : String(error ?? '');
      toast({
        title: 'Could not get your location',
        description: /permission/i.test(message)
          ? 'Location permission is blocked. Allow location for this app in your device settings, then try again.'
          : message || 'Your device could not provide a location.',
        variant: 'destructive',
      });
    };

    try {
      const watchId = await LocationService.watchPosition(
        (loc) => {
          if (!isCurrent()) return;
          if (locateTimeoutRef.current !== null) {
            window.clearTimeout(locateTimeoutRef.current);
            locateTimeoutRef.current = null;
          }
          setLocating(false);
          setMyLocation({ latitude: loc.latitude, longitude: loc.longitude });
        },
        (error) => {
          if (!isCurrent()) return;
          reportFailure(error);
        }
      );

      if (!isCurrent()) {
        // Cancelled while the permission prompt was open — don't leave a watch running.
        LocationService.clearWatch(watchId).catch(() => {});
        return;
      }

      watchIdRef.current = watchId;
    } catch (error) {
      if (isCurrent()) reportFailure(error);
    }
  };

  // Clean up the geolocation watch (and any pending timeout) on unmount
  useEffect(() => {
    return () => {
      if (locateTimeoutRef.current !== null) {
        window.clearTimeout(locateTimeoutRef.current);
      }
      if (watchIdRef.current !== null) {
        LocationService.clearWatch(watchIdRef.current).catch(() => {});
      }
    };
  }, []);

  // District-wise sales: attribute each customer's last-90-day invoice total to
  // the district of that customer's SHOP (matches the map pins). Invoice GPS is
  // where the sale was recorded (often not the shop), so we use shop location.
  useEffect(() => {
    if (selectedAgencies.length === 0) { setDistrictSales([]); setDistrictSalesTotal(0); return; }
    let cancelled = false;
    (async () => {
      setDistrictSalesLoading(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - 90);
        const [features, invoices, customers] = await Promise.all([
          loadDistrictFeatures(),
          fetchAllSupabaseRows<{ customer_id: string | null; customer_name: string | null; total: number | null; agency_id: string | null }>(() =>
            supabase
              .from('invoices')
              .select('customer_id, customer_name, total, agency_id')
              .in('agency_id', selectedAgencies)
              .gte('created_at', since.toISOString())
          ),
          fetchAllSupabaseRows<{ id: string; name: string | null; agency_id: string; latitude: number | null; longitude: number | null }>(() =>
            supabase
              .from('customers')
              .select('id, name, agency_id, latitude, longitude')
              .in('agency_id', selectedAgencies)
          ),
        ]);
        if (cancelled) return;

        // Per-customer 90-day sales (same logic as the map pins).
        const sumById = new Map<string, number>();
        const sumByAgencyName = new Map<string, number>();
        invoices.forEach((inv) => {
          const amt = Number(inv.total || 0);
          if (inv.customer_id) sumById.set(inv.customer_id, (sumById.get(inv.customer_id) || 0) + amt);
          const nm = (inv.customer_name || '').toLowerCase().trim();
          if (nm && inv.agency_id) {
            const k = `${inv.agency_id}:${nm}`;
            sumByAgencyName.set(k, (sumByAgencyName.get(k) || 0) + amt);
          }
        });

        const byDistrict = new Map<string, { total: number; count: number }>();
        let grand = 0;
        customers.forEach((c) => {
          const amt = sumById.get(c.id) ?? sumByAgencyName.get(`${c.agency_id}:${(c.name || '').toLowerCase().trim()}`) ?? 0;
          if (amt <= 0) return; // only shops with sales
          const lat = Number(c.latitude), lng = Number(c.longitude);
          const d = isWithinSriLanka(lat, lng) ? (districtForPoint(lat, lng, features) || 'Unknown') : 'Unknown (no GPS)';
          const cur = byDistrict.get(d) || { total: 0, count: 0 };
          cur.total += amt; cur.count += 1;
          byDistrict.set(d, cur);
          grand += amt;
        });

        const rows = Array.from(byDistrict.entries())
          .map(([district, v]) => ({ district: district.replace(/\s+District$/i, ''), total: v.total, count: v.count }))
          .sort((a, b) => b.total - a.total);

        if (!cancelled) { setDistrictSales(rows); setDistrictSalesTotal(grand); }
      } catch {
        if (!cancelled) { setDistrictSales([]); setDistrictSalesTotal(0); }
      } finally {
        if (!cancelled) setDistrictSalesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedAgencies]);

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

            <div className="flex flex-wrap items-center gap-2">
              {/* Superuser: ask an agent's app for its current position */}
              {user.role === 'superuser' && (
                <div className="flex items-center gap-1">
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="h-9 w-[190px]">
                      <SelectValue placeholder="Select agent…" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}{a.agencyName ? ` · ${a.agencyName}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!selectedAgentId || locatingAgent}
                    onClick={locateAgent}
                  >
                    {locatingAgent ? 'Asking…' : 'Locate'}
                  </Button>
                </div>
              )}

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
          <LeafletMap locations={locations} height="500px" myLocation={myLocation} agentLocation={agentLocation} showDistricts={showDistricts} />

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

      {/* District-wise Sales (last 90 days) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              District-wise Sales (Last 90 Days)
            </span>
            <span className="text-base font-bold text-green-700">
              Total: LKR {districtSalesTotal.toLocaleString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {districtSalesLoading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Calculating district sales…</div>
          ) : districtSales.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No invoiced sales with GPS in the last 90 days.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="px-3 py-2 font-semibold">District</th>
                    <th className="px-3 py-2 font-semibold text-right">Shops</th>
                    <th className="px-3 py-2 font-semibold text-right">Sales (LKR)</th>
                    <th className="px-3 py-2 font-semibold text-right">% of Total</th>
                    <th className="px-3 py-2 font-semibold w-40">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {districtSales.map((row) => {
                    const pct = districtSalesTotal > 0 ? (row.total / districtSalesTotal) * 100 : 0;
                    return (
                      <tr key={row.district} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{row.district}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{row.count}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">{row.total.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{pct.toFixed(1)}%</td>
                        <td className="px-3 py-2">
                          <div className="h-2 w-full bg-gray-100 rounded">
                            <div className="h-2 rounded bg-blue-500" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{districtSales.reduce((s, r) => s + r.count, 0)}</td>
                    <td className="px-3 py-2 text-right text-green-700">{districtSalesTotal.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">100%</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tbody>
              </table>
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
