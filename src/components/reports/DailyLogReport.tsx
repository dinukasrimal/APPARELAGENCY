import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, MapPin, Users, ShoppingCart, Receipt, AlertTriangle, Download, ChevronLeft, ChevronRight, DollarSign, Image as ImageIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import LeafletMap from '@/components/dashboard/LeafletMap';
import ImageModal from '@/components/ui/image-modal';

interface DailyLogEntry {
  id: string;
  type: 'clock_in' | 'clock_out' | 'customer' | 'non_productive' | 'sales_order' | 'invoice' | 'collection';
  name: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  details?: string;
  agencyName?: string;
  userId?: string;
  userName?: string;
  orderNumber?: number;
  storefrontPhoto?: string;
}

interface Agency {
  id: string;
  name: string;
}

interface ReportUser {
  id: string;
  name: string;
  agencyId: string;
  role: string;
}

interface DailyLogReportProps {
  user: User;
}

const DailyLogReport = ({ user }: DailyLogReportProps) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'dateRange'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAgency, setSelectedAgency] = useState<string>(user.role === 'superuser' ? '' : user.agencyId || '');
  const [selectedUser, setSelectedUser] = useState<string>(user.role === 'superuser' ? 'all' : user.id);
  const [logEntries, setLogEntries] = useState<DailyLogEntry[]>([]);
  const [datesWithLogs, setDatesWithLogs] = useState<Set<string>>(new Set());
  const [daysWorked, setDaysWorked] = useState<number>(0);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [users, setUsers] = useState<ReportUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (user.role === 'superuser') {
      fetchAgencies();
    } else {
      setSelectedAgency(user.agencyId!);
      fetchUsersForAgency(user.agencyId!);
    }
  }, [user]);

  useEffect(() => {
    if (selectedAgency) {
      fetchUsersForAgency(selectedAgency);
    }
  }, [selectedAgency]);

  useEffect(() => {
    if (selectedAgency && viewMode === 'calendar') {
      fetchMonthlyLogDates();
    }
  }, [selectedMonth, selectedAgency, selectedUser, viewMode]);

  useEffect(() => {
    if (selectedDate && selectedAgency && viewMode === 'calendar') {
      // Format the date in local timezone to avoid UTC conversion issues
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      fetchDailyLogs(dateStr);
    }
  }, [selectedDate, selectedAgency, selectedUser, viewMode]);

  useEffect(() => {
    if (startDate && endDate && selectedAgency && viewMode === 'dateRange') {
      fetchDateRangeLogs();
    }
  }, [startDate, endDate, selectedAgency, selectedUser, viewMode]);

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
    }
  };

  const fetchUsersForAgency = async (agencyId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, agency_id, role')
        .eq('agency_id', agencyId)
        .order('name');
      
      if (error) throw error;
      const mappedUsers = (data || []).map(user => ({
        id: user.id,
        name: user.name,
        agencyId: user.agency_id,
        role: user.role
      }));
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Handle image click to open modal
  const handleImageClick = (imageUrl: string, entryName: string, entryType: string) => {
    const entryTypeLabel = entryType === 'customer' ? 'Customer' : 'Non-Productive Visit';
    setSelectedImage({ url: imageUrl, title: `${entryTypeLabel}: ${entryName}` });
    setImageModalOpen(true);
  };

  // Close image modal
  const closeImageModal = () => {
    setImageModalOpen(false);
    setSelectedImage(null);
  };

  const fetchMonthlyLogDates = async () => {
    if (!selectedAgency) return;
    
    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      
      // Convert local dates to UTC for proper database filtering
      const localStartOfMonth = new Date(year, month, 1);
      const localEndOfMonth = new Date(year, month + 1, 0);
      const utcStartOfMonth = new Date(localStartOfMonth.getTime() - localStartOfMonth.getTimezoneOffset() * 60000);
      const utcEndOfMonth = new Date(localEndOfMonth.getTime() - localEndOfMonth.getTimezoneOffset() * 60000 + 24 * 60 * 60 * 1000 - 1);
      
      const startOfMonth = utcStartOfMonth.toISOString();
      const endOfMonth = utcEndOfMonth.toISOString();
      
      const datesSet = new Set<string>();
      
      // Apply user filter if not superuser or specific user selected
      const userFilter = user.role === 'superuser' && selectedUser === 'all' ? undefined : (selectedUser || user.id);
      
      // Time tracking dates
      let timeQuery = supabase
        .from('time_tracking')
        .select('date')
        .eq('agency_id', selectedAgency)
        .gte('date', utcStartOfMonth.toISOString().split('T')[0])
        .lte('date', utcEndOfMonth.toISOString().split('T')[0]);
      
      if (userFilter) {
        timeQuery = timeQuery.eq('user_id', userFilter);
      }

      const { data: timeData } = await timeQuery;
      timeData?.forEach(item => datesSet.add(item.date));

      // Customer creation dates
      let customerQuery = supabase
        .from('customers')
        .select('created_at')
        .eq('agency_id', selectedAgency)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (userFilter) {
        customerQuery = customerQuery.eq('created_by', userFilter);
      }

      const { data: customers } = await customerQuery;
      customers?.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        datesSet.add(date);
      });

      // Non-productive visits dates
      let npQuery = supabase
        .from('non_productive_visits')
        .select('created_at')
        .eq('agency_id', selectedAgency)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (userFilter) {
        npQuery = npQuery.eq('user_id', userFilter);
      }

      const { data: npVisits } = await npQuery;
      npVisits?.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        datesSet.add(date);
      });

      // Sales orders dates
      let soQuery = supabase
        .from('sales_orders')
        .select('created_at')
        .eq('agency_id', selectedAgency)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (userFilter) {
        soQuery = soQuery.eq('created_by', userFilter);
      }

      const { data: orders } = await soQuery;
      orders?.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        datesSet.add(date);
      });

      // Invoices dates
      let invoiceQuery = supabase
        .from('invoices')
        .select('created_at')
        .eq('agency_id', selectedAgency)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (userFilter) {
        invoiceQuery = invoiceQuery.eq('created_by', userFilter);
      }

      const { data: invoices } = await invoiceQuery;
      invoices?.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        datesSet.add(date);
      });

      // Collections dates
      let collectionQuery = supabase
        .from('collections')
        .select('created_at')
        .eq('agency_id', selectedAgency)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (userFilter) {
        collectionQuery = collectionQuery.eq('created_by', userFilter);
      }

      const { data: collections } = await collectionQuery;
      collections?.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        datesSet.add(date);
      });

      setDatesWithLogs(datesSet);
      setDaysWorked(datesSet.size);
    } catch (error) {
      console.error('Error fetching monthly log dates:', error);
    }
  };

  const fetchDailyLogs = async (dateStr: string) => {
    setLoading(true);
    try {
      const entries: DailyLogEntry[] = [];
      
      // Convert local date to UTC for proper database filtering
      const localDate = new Date(dateStr + 'T00:00:00');
      const utcStartDate = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);
      const utcEndDate = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000 + 24 * 60 * 60 * 1000 - 1);
      
      const startDate = utcStartDate.toISOString();
      const endDate = utcEndDate.toISOString();
      
      const agencyFilter = selectedAgency;
      const userFilter = user.role === 'superuser' && selectedUser === 'all' ? undefined : (selectedUser || user.id);

      // Fetch time tracking (clock in/out)
      let timeQuery = supabase
        .from('time_tracking')
        .select('id, user_id, clock_in_time, clock_out_time, clock_in_latitude, clock_in_longitude, clock_out_latitude, clock_out_longitude, agency_id')
        .eq('agency_id', agencyFilter)
        .eq('date', dateStr);
      
      if (userFilter) {
        timeQuery = timeQuery.eq('user_id', userFilter);
      }

      const { data: timeData } = await timeQuery;

      // Process time tracking data
      timeData?.forEach(time => {
        const user = users.find(u => u.id === time.user_id);
        const agency = agencies.find(a => a.id === time.agency_id);
        
        // Clock in entry
        if (time.clock_in_latitude && time.clock_in_longitude) {
          entries.push({
            id: `${time.id}-in`,
            type: 'clock_in',
            name: 'Clock In',
            latitude: time.clock_in_latitude,
            longitude: time.clock_in_longitude,
            timestamp: new Date(time.clock_in_time),
            agencyName: agency?.name || 'Unknown Agency',
            userId: time.user_id,
            userName: user?.name || 'Unknown User'
          });
        }

        // Clock out entry
        if (time.clock_out_time && time.clock_out_latitude && time.clock_out_longitude) {
          entries.push({
            id: `${time.id}-out`,
            type: 'clock_out',
            name: 'Clock Out',
            latitude: time.clock_out_latitude,
            longitude: time.clock_out_longitude,
            timestamp: new Date(time.clock_out_time),
            agencyName: agency?.name || 'Unknown Agency',
            userId: time.user_id,
            userName: user?.name || 'Unknown User'
          });
        }
      });

      // Fetch customers visited
      let customerQuery = supabase
        .from('customers')
        .select('id, name, latitude, longitude, created_at, agency_id, created_by, storefront_photo')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        customerQuery = customerQuery.eq('created_by', userFilter);
      }

      const { data: customers } = await customerQuery;

      customers?.forEach(customer => {
        const user = users.find(u => u.id === customer.created_by);
        const agency = agencies.find(a => a.id === customer.agency_id);
        entries.push({
          id: customer.id,
          type: 'customer',
          name: customer.name,
          latitude: customer.latitude,
          longitude: customer.longitude,
          timestamp: new Date(customer.created_at),
          details: 'Customer Visit',
          agencyName: agency?.name || 'Unknown Agency',
          userId: customer.created_by,
          userName: user?.name || 'Unknown User',
          storefrontPhoto: customer.storefront_photo
        });
      });

      // Fetch non-productive visits
      let npQuery = supabase
        .from('non_productive_visits')
        .select('id, reason, latitude, longitude, created_at, agency_id, user_id, store_front_photo')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (userFilter) {
        npQuery = npQuery.eq('user_id', userFilter);
      }

      const { data: npVisits } = await npQuery;

      npVisits?.forEach(visit => {
        const user = users.find(u => u.id === visit.user_id);
        const agency = agencies.find(a => a.id === visit.agency_id);
        entries.push({
          id: visit.id,
          type: 'non_productive',
          name: 'Non-productive Visit',
          latitude: visit.latitude,
          longitude: visit.longitude,
          timestamp: new Date(visit.created_at),
          details: visit.reason,
          agencyName: agency?.name || 'Unknown Agency',
          userId: visit.user_id,
          userName: user?.name || 'Unknown User',
          storefrontPhoto: visit.store_front_photo
        });
      });

      // Fetch sales orders
      let soQuery = supabase
        .from('sales_orders')
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        soQuery = soQuery.eq('created_by', userFilter);
      }

      const { data: orders } = await soQuery;

      orders?.forEach(order => {
        const user = users.find(u => u.id === order.created_by);
        const agency = agencies.find(a => a.id === order.agency_id);
        entries.push({
          id: order.id,
          type: 'sales_order',
          name: order.customer_name,
          latitude: order.latitude,
          longitude: order.longitude,
          timestamp: new Date(order.created_at),
          details: 'Sales Order',
          agencyName: agency?.name || 'Unknown Agency',
          userId: order.created_by,
          userName: user?.name || 'Unknown User'
        });
      });

      // Fetch invoices
      let invoiceQuery = supabase
        .from('invoices')
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        invoiceQuery = invoiceQuery.eq('created_by', userFilter);
      }

      const { data: invoices } = await invoiceQuery;

      invoices?.forEach(invoice => {
        const user = users.find(u => u.id === invoice.created_by);
        const agency = agencies.find(a => a.id === invoice.agency_id);
        entries.push({
          id: invoice.id,
          type: 'invoice',
          name: invoice.customer_name,
          latitude: invoice.latitude,
          longitude: invoice.longitude,
          timestamp: new Date(invoice.created_at),
          details: 'Invoice',
          agencyName: agency?.name || 'Unknown Agency',
          userId: invoice.created_by,
          userName: user?.name || 'Unknown User'
        });
      });

      // Fetch collection locations
      let collectionQuery = supabase
        .from('collections')
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by, total_amount, payment_method')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        collectionQuery = collectionQuery.eq('created_by', userFilter);
      }

      const { data: collections } = await collectionQuery;
      
      collections?.forEach((collection, index) => {
        const user = users.find(u => u.id === collection.created_by);
        const agency = agencies.find(a => a.id === collection.agency_id);
        
        entries.push({
          id: collection.id,
          type: 'collection',
          name: collection.customer_name,
          latitude: collection.latitude,
          longitude: collection.longitude,
          timestamp: new Date(collection.created_at),
          details: `Collection: LKR ${collection.total_amount.toLocaleString()} (${collection.payment_method})`,
          agencyName: agency?.name || 'Unknown Agency',
          userId: collection.created_by,
          userName: user?.name || 'Unknown User',
          orderNumber: entries.length + 1
        });
      });

      // Sort entries by timestamp and assign order numbers
      entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      entries.forEach((entry, index) => {
        entry.orderNumber = index + 1;
      });
      
      setLogEntries(entries);
    } catch (error) {
      console.error('Error fetching daily logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDateRangeLogs = async () => {
    setLoading(true);
    try {
      const entries: DailyLogEntry[] = [];
      
      // Convert local dates to UTC for proper database filtering
      const localStartDate = new Date(startDate + 'T00:00:00');
      const localEndDate = new Date(endDate + 'T23:59:59');
      const utcStartDate = new Date(localStartDate.getTime() - localStartDate.getTimezoneOffset() * 60000);
      const utcEndDate = new Date(localEndDate.getTime() - localEndDate.getTimezoneOffset() * 60000);
      
      const startDateTime = utcStartDate.toISOString();
      const endDateTime = utcEndDate.toISOString();
      
      const agencyFilter = selectedAgency;
      const userFilter = user.role === 'superuser' && selectedUser === 'all' ? undefined : (selectedUser || user.id);

      // Get all dates in range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const datesInRange: string[] = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesInRange.push(d.toISOString().split('T')[0]);
      }

      // Fetch time tracking for all dates
      let timeQuery = supabase
        .from('time_tracking')
        .select('id, user_id, clock_in_time, clock_out_time, clock_in_latitude, clock_in_longitude, clock_out_latitude, clock_out_longitude, agency_id, date')
        .eq('agency_id', agencyFilter)
        .in('date', datesInRange);
      
      if (userFilter) {
        timeQuery = timeQuery.eq('user_id', userFilter);
      }

      const { data: timeData } = await timeQuery;

      timeData?.forEach(time => {
        const user = users.find(u => u.id === time.user_id);
        const agency = agencies.find(a => a.id === time.agency_id);
        
        if (time.clock_in_latitude && time.clock_in_longitude) {
          entries.push({
            id: `${time.id}-in`,
            type: 'clock_in',
            name: 'Clock In',
            latitude: time.clock_in_latitude,
            longitude: time.clock_in_longitude,
            timestamp: new Date(time.clock_in_time),
            agencyName: agency?.name || 'Unknown Agency',
            userId: time.user_id,
            userName: user?.name || 'Unknown User'
          });
        }

        if (time.clock_out_time && time.clock_out_latitude && time.clock_out_longitude) {
          entries.push({
            id: `${time.id}-out`,
            type: 'clock_out',
            name: 'Clock Out',
            latitude: time.clock_out_latitude,
            longitude: time.clock_out_longitude,
            timestamp: new Date(time.clock_out_time),
            agencyName: agency?.name || 'Unknown Agency',
            userId: time.user_id,
            userName: user?.name || 'Unknown User'
          });
        }
      });

      // Fetch other data similar to daily logs but with date range
      let customerQuery = supabase
        .from('customers')
        .select('id, name, latitude, longitude, created_at, agency_id, created_by, storefront_photo')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        customerQuery = customerQuery.eq('created_by', userFilter);
      }

      const { data: customers } = await customerQuery;

      customers?.forEach(customer => {
        const user = users.find(u => u.id === customer.created_by);
        const agency = agencies.find(a => a.id === customer.agency_id);
        entries.push({
          id: customer.id,
          type: 'customer',
          name: customer.name,
          latitude: customer.latitude,
          longitude: customer.longitude,
          timestamp: new Date(customer.created_at),
          details: 'Customer Visit',
          agencyName: agency?.name || 'Unknown Agency',
          userId: customer.created_by,
          userName: user?.name || 'Unknown User',
          storefrontPhoto: customer.storefront_photo
        });
      });

      let npQuery = supabase
        .from('non_productive_visits')
        .select('id, reason, latitude, longitude, created_at, agency_id, user_id, store_front_photo')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime);

      if (userFilter) {
        npQuery = npQuery.eq('user_id', userFilter);
      }

      const { data: npVisits } = await npQuery;

      npVisits?.forEach(visit => {
        const user = users.find(u => u.id === visit.user_id);
        const agency = agencies.find(a => a.id === visit.agency_id);
        entries.push({
          id: visit.id,
          type: 'non_productive',
          name: 'Non-productive Visit',
          latitude: visit.latitude,
          longitude: visit.longitude,
          timestamp: new Date(visit.created_at),
          details: visit.reason,
          agencyName: agency?.name || 'Unknown Agency',
          userId: visit.user_id,
          userName: user?.name || 'Unknown User',
          storefrontPhoto: visit.store_front_photo
        });
      });

      let soQuery = supabase
        .from('sales_orders')
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        soQuery = soQuery.eq('created_by', userFilter);
      }

      const { data: orders } = await soQuery;

      orders?.forEach(order => {
        const user = users.find(u => u.id === order.created_by);
        const agency = agencies.find(a => a.id === order.agency_id);
        entries.push({
          id: order.id,
          type: 'sales_order',
          name: order.customer_name,
          latitude: order.latitude,
          longitude: order.longitude,
          timestamp: new Date(order.created_at),
          details: 'Sales Order',
          agencyName: agency?.name || 'Unknown Agency',
          userId: order.created_by,
          userName: user?.name || 'Unknown User'
        });
      });

      let invoiceQuery = supabase
        .from('invoices')
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        invoiceQuery = invoiceQuery.eq('created_by', userFilter);
      }

      const { data: invoices } = await invoiceQuery;

      invoices?.forEach(invoice => {
        const user = users.find(u => u.id === invoice.created_by);
        const agency = agencies.find(a => a.id === invoice.agency_id);
        entries.push({
          id: invoice.id,
          type: 'invoice',
          name: invoice.customer_name,
          latitude: invoice.latitude,
          longitude: invoice.longitude,
          timestamp: new Date(invoice.created_at),
          details: 'Invoice',
          agencyName: agency?.name || 'Unknown Agency',
          userId: invoice.created_by,
          userName: user?.name || 'Unknown User'
        });
      });

      // Fetch collection locations
      let collectionQuery = supabase
        .from('collections')
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by, total_amount, payment_method')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        collectionQuery = collectionQuery.eq('created_by', userFilter);
      }

      const { data: collections } = await collectionQuery;
      
      collections?.forEach((collection, index) => {
        const user = users.find(u => u.id === collection.created_by);
        const agency = agencies.find(a => a.id === collection.agency_id);
        
        entries.push({
          id: collection.id,
          type: 'collection',
          name: collection.customer_name,
          latitude: collection.latitude,
          longitude: collection.longitude,
          timestamp: new Date(collection.created_at),
          details: `Collection: LKR ${collection.total_amount.toLocaleString()} (${collection.payment_method})`,
          agencyName: agency?.name || 'Unknown Agency',
          userId: collection.created_by,
          userName: user?.name || 'Unknown User',
          orderNumber: entries.length + 1
        });
      });

      // Sort entries by timestamp and assign order numbers
      entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      entries.forEach((entry, index) => {
        entry.orderNumber = index + 1;
      });
      
      setLogEntries(entries);
    } catch (error) {
      console.error('Error fetching date range logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'clock_in': return Clock;
      case 'clock_out': return Clock;
      case 'customer': return Users;
      case 'non_productive': return AlertTriangle;
      case 'sales_order': return ShoppingCart;
      case 'invoice': return Receipt;
      case 'collection': return DollarSign;
      default: return MapPin;
    }
  };

  const getEntryColor = (type: string) => {
    switch (type) {
      case 'clock_in': return '#10B981';
      case 'clock_out': return '#EF4444';
      case 'customer': return '#EAB308';
      case 'non_productive': return '#F59E0B';
      case 'sales_order': return '#000000';
      case 'invoice': return '#22C55E';
      case 'collection': return '#8B5CF6'; // Purple color for collections
      default: return '#6B7280';
    }
  };

  const exportToCSV = () => {
    const headers = ['Order', 'Time', 'Type', 'Name/Description', 'Details', 'User', 'Agency', 'Latitude', 'Longitude'];
    const csvData = logEntries.map(entry => [
      entry.orderNumber || '',
      entry.timestamp.toLocaleString(),
      entry.type.replace('_', ' ').toUpperCase(),
      entry.name,
      entry.details || '',
      entry.userName || '',
      entry.agencyName || '',
      entry.latitude.toFixed(6),
      entry.longitude.toFixed(6)
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-log-${viewMode === 'calendar' ? selectedDate?.toISOString().split('T')[0] : `${startDate}-to-${endDate}`}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const modifiers = {
    hasLogs: Array.from(datesWithLogs).map(dateStr => new Date(dateStr))
  };

  const modifiersStyles = {
    hasLogs: {
      backgroundColor: '#EF4444',
      color: 'white',
      fontWeight: 'bold'
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Log Report</h2>
          <p className="text-gray-600">Track daily progress with GPS coordinates and timestamps</p>
        </div>
        
        <div className="flex gap-2">
          <div className="flex gap-2">
            <Button 
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              onClick={() => setViewMode('calendar')}
              size="sm"
            >
              Calendar View
            </Button>
            <Button 
              variant={viewMode === 'dateRange' ? 'default' : 'outline'}
              onClick={() => setViewMode('dateRange')}
              size="sm"
            >
              Date Range
            </Button>
          </div>
          <Button onClick={exportToCSV} disabled={logEntries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {viewMode === 'dateRange' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {user.role === 'superuser' && (
              <div>
                <label className="block text-sm font-medium mb-2">Agency</label>
                <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map(agency => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {user.role === 'superuser' && (
              <div>
                <label className="block text-sm font-medium mb-2">User (Optional)</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Calendar - {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </CardTitle>
                <p className="text-sm text-gray-600">Red dates have activity logs. Click a date to view details.</p>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                  className="rounded-md border pointer-events-auto"
                />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Monthly Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{daysWorked}</div>
                    <div className="text-sm text-gray-600">Days Worked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedDate && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {selectedDate.toLocaleDateString()} - Activities ({logEntries.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : logEntries.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No activities found for this date
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {logEntries.map((entry) => {
                        const Icon = getEntryIcon(entry.type);
                        return (
                          <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: getEntryColor(entry.type) }}
                              >
                                {entry.orderNumber}
                              </div>
                              <Icon className="h-4 w-4" style={{ color: getEntryColor(entry.type) }} />
                            </div>
                            {/* Storefront Photo Thumbnail */}
                            {entry.storefrontPhoto && (entry.type === 'customer' || entry.type === 'non_productive') && (
                              <div 
                                className="relative cursor-pointer group flex-shrink-0"
                                onClick={() => handleImageClick(entry.storefrontPhoto!, entry.name, entry.type)}
                              >
                                <img
                                  src={entry.storefrontPhoto}
                                  alt={`${entry.name} storefront`}
                                  className="w-10 h-10 object-cover rounded border-2 border-gray-200 group-hover:border-blue-400 transition-colors"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all flex items-center justify-center">
                                  <ImageIcon className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )}
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm">{entry.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {entry.type.replace('_', ' ').toUpperCase()}
                                </Badge>
                                {entry.storefrontPhoto && (entry.type === 'customer' || entry.type === 'non_productive') && (
                                  <Badge variant="secondary" className="text-xs">
                                    📷 Photo
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-600">
                                <div>{entry.timestamp.toLocaleTimeString()}</div>
                                {entry.details && <div>{entry.details}</div>}
                                {user.role === 'superuser' && entry.userName && <div>User: {entry.userName}</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Map View with numbered markers */}
      {logEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Activity Map - {viewMode === 'calendar' ? selectedDate?.toLocaleDateString() : `${startDate} to ${endDate}`} ({logEntries.length} activities)
            </CardTitle>
            <div className="flex flex-wrap gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm">Clock In</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm">Clock Out</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span className="text-sm">Customer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm">Non-Productive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-black"></div>
                <span className="text-sm">Sales Order</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm">Invoice</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <LeafletMap 
              locations={logEntries.map(entry => ({
                id: entry.id,
                type: entry.type as any,
                name: `${entry.orderNumber}. ${entry.name}`,
                latitude: entry.latitude,
                longitude: entry.longitude,
                timestamp: entry.timestamp,
                details: entry.details,
                agencyName: entry.agencyName
              }))} 
              height="600px" 
            />
          </CardContent>
        </Card>
      )}

      {/* Timeline View for Date Range */}
      {viewMode === 'dateRange' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeline View
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading logs...</div>
            ) : logEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No activities found for the selected date range and filters
              </div>
            ) : (
              <div className="space-y-4">
                {logEntries.map((entry) => {
                  const Icon = getEntryIcon(entry.type);
                  return (
                    <div key={entry.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: getEntryColor(entry.type) }}
                        >
                          {entry.orderNumber}
                        </div>
                        <Icon className="h-5 w-5" style={{ color: getEntryColor(entry.type) }} />
                      </div>

                      {/* Storefront Photo Thumbnail */}
                      {entry.storefrontPhoto && (entry.type === 'customer' || entry.type === 'non_productive') && (
                        <div 
                          className="relative cursor-pointer group flex-shrink-0"
                          onClick={() => handleImageClick(entry.storefrontPhoto!, entry.name, entry.type)}
                        >
                          <img
                            src={entry.storefrontPhoto}
                            alt={`${entry.name} storefront`}
                            className="w-12 h-12 object-cover rounded border-2 border-gray-200 group-hover:border-blue-400 transition-colors"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{entry.name}</h4>
                          <Badge variant="outline">
                            {entry.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {entry.storefrontPhoto && (entry.type === 'customer' || entry.type === 'non_productive') && (
                            <Badge variant="secondary" className="text-xs">
                              📷 Photo
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>{entry.details}</div>
                          {user.role === 'superuser' && entry.userName && (
                            <div>User: {entry.userName}</div>
                          )}
                          <div>Agency: {entry.agencyName}</div>
                          <div>GPS: {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-medium">
                          {entry.timestamp.toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {entry.timestamp.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          isOpen={imageModalOpen}
          onClose={closeImageModal}
          imageUrl={selectedImage.url}
          title={selectedImage.title}
        />
      )}
    </div>
  );
};

export default DailyLogReport;
