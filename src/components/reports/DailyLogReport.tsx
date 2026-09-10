import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, MapPin, Users, ShoppingCart, Receipt, AlertTriangle, Download, ChevronLeft, ChevronRight, DollarSign, Image as ImageIcon, ArrowLeft, Truck, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LeafletMap from '@/components/dashboard/LeafletMap';
import ImageModal from '@/components/ui/image-modal';
import { fetchAllSupabaseRows } from '@/utils/supabasePagination';
import { isWithinSriLanka } from '@/utils/geoBounds';

interface DailyLogEntry {
  id: string;
  type: 'clock_in' | 'clock_out' | 'customer' | 'non_productive' | 'sales_order' | 'invoice' | 'collection' | 'delivery';
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
  amount?: number;
  salesOrderId?: string;         // set on invoices/deliveries traced back to a sales order
  salesOrderAmount?: number;     // that sales order's total (shown on the invoice entry)
  daysToConvert?: number;        // days from that sales order to this invoice/delivery
  categoryBreakdown?: { category: string; amount: number }[]; // sales_order / invoice only
}

interface TimeRoutePath {
  id: string;
  label: string;
  color: string;
  points: Array<{
    latitude: number;
    longitude: number;
    recordedAt: Date;
  }>;
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
  onBack: () => void;
}

const DailyLogReport = ({ user, onBack }: DailyLogReportProps) => {
  const ROUTE_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#EC4899'];
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
  const [timeRoutes, setTimeRoutes] = useState<TimeRoutePath[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<DailyLogEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Only a superuser with access to all agencies may delete activities.
  const canDelete = user.role === 'superuser';

  // Re-run the current view's fetch after a delete.
  const refetchCurrent = () => {
    if (viewMode === 'calendar' && selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      fetchDailyLogs(`${y}-${m}-${d}`);
      fetchMonthlyLogDates();
    } else {
      fetchDateRangeLogs();
    }
  };

  // Delete an activity's underlying record(s), based on its type.
  const deleteEntry = async (entry: DailyLogEntry) => {
    setIsDeleting(true);
    try {
      if (entry.type === 'clock_in' || entry.type === 'clock_out') {
        // entry.id is `${timeTrackingId}-in` / `-out`
        const timeId = entry.id.replace(/-(in|out)$/, '');
        const { error } = await supabase.from('time_tracking').delete().eq('id', timeId);
        if (error) throw error;
      } else if (entry.type === 'customer') {
        const { error } = await supabase.from('customers').delete().eq('id', entry.id);
        if (error) throw error;
      } else if (entry.type === 'non_productive') {
        const { error } = await supabase.from('non_productive_visits').delete().eq('id', entry.id);
        if (error) throw error;
      } else if (entry.type === 'sales_order') {
        await supabase.from('sales_order_items').delete().eq('sales_order_id', entry.id);
        const { error } = await supabase.from('sales_orders').delete().eq('id', entry.id);
        if (error) throw error;
      } else if (entry.type === 'invoice') {
        // Clear dependents first, then the invoice.
        await supabase.from('collection_allocations').delete().eq('invoice_id', entry.id);
        await (supabase as any).from('deliveries').delete().eq('invoice_id', entry.id);
        await supabase.from('invoice_items').delete().eq('invoice_id', entry.id);
        const { error } = await supabase.from('invoices').delete().eq('id', entry.id);
        if (error) throw error;
      } else if (entry.type === 'collection') {
        await supabase.from('collection_allocations').delete().eq('collection_id', entry.id);
        await supabase.from('collection_cheques').delete().eq('collection_id', entry.id);
        const { error } = await supabase.from('collections').delete().eq('id', entry.id);
        if (error) throw error;
      } else if (entry.type === 'delivery') {
        const delId = entry.id.replace(/^delivery-/, '');
        const { error } = await (supabase as any).from('deliveries').delete().eq('id', delId);
        if (error) throw error;
      }
      toast({ title: 'Deleted', description: `${entry.type.replace('_', ' ')} activity removed.` });
      setEntryToDelete(null);
      refetchCurrent();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message || 'Could not delete this activity', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

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
    const labels: Record<string, string> = {
      customer: 'Customer',
      non_productive: 'Non-Productive Visit',
      invoice: 'Invoice',
      collection: 'Collection',
      sales_order: 'Sales Order',
      delivery: 'Delivery',
    };
    const entryTypeLabel = labels[entryType] || 'Customer';
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

      const invoices = await fetchAllSupabaseRows<any>(() => invoiceQuery);
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

  // Attach the customer storefront photo to every entry that has a customer
  // (invoice / collection / sales order / delivery — not just customer visits);
  // compute days-since-sales-order and the sales order's own value for
  // invoices/deliveries traced back to one; attach category-wise breakdowns to
  // sales_order and invoice entries; and drop a sales_order entry whenever an
  // invoice against it is also in this batch, so a partially-invoiced order
  // doesn't show as two separate activities — only the invoice entry remains,
  // carrying both the sales order's value and the invoice's value.
  const enrichEntries = async (entries: DailyLogEntry[], agencyFilter: string) => {
    const norm = (s?: string) => (s || '').toLowerCase().trim();

    // 1. Customer photos, keyed by name (daily log is scoped to one agency)
    const custRows = await fetchAllSupabaseRows<{ name: string | null; storefront_photo: string | null }>(
      () => supabase.from('customers').select('name, storefront_photo').eq('agency_id', agencyFilter)
    );
    const photoByName = new Map<string, string>();
    custRows.forEach((c) => {
      if (c.storefront_photo) photoByName.set(norm(c.name), c.storefront_photo);
    });

    // 2. Sales orders behind invoices/deliveries traced back to one
    const soIds = Array.from(new Set(
      entries.filter((e) => (e.type === 'invoice' || e.type === 'delivery') && e.salesOrderId)
        .map((e) => e.salesOrderId!)
    ));
    const soCreatedById = new Map<string, string>();
    const soTotalById = new Map<string, number>();
    if (soIds.length > 0) {
      const soRows = await fetchAllSupabaseRows<{ id: string; created_at: string | null; total: number | null }>(
        () => supabase.from('sales_orders').select('id, created_at, total').in('id', soIds)
      );
      soRows.forEach((s) => {
        if (s.created_at) soCreatedById.set(s.id, s.created_at);
        soTotalById.set(s.id, Number(s.total) || 0);
      });
    }

    // 3. Category-wise breakdown for sales_order and invoice entries, via each
    // line item's product -> products.category
    const soEntryIds = entries.filter((e) => e.type === 'sales_order').map((e) => e.id);
    const invoiceEntryIds = entries.filter((e) => e.type === 'invoice').map((e) => e.id);

    const soItems = soEntryIds.length > 0
      ? await fetchAllSupabaseRows<{ sales_order_id: string; product_id: string | null; total: number | null }>(
          () => supabase.from('sales_order_items').select('sales_order_id, product_id, total').in('sales_order_id', soEntryIds)
        )
      : [];
    const invoiceItems = invoiceEntryIds.length > 0
      ? await fetchAllSupabaseRows<{ invoice_id: string; product_id: string | null; total: number | null }>(
          () => supabase.from('invoice_items').select('invoice_id, product_id, total').in('invoice_id', invoiceEntryIds)
        )
      : [];

    const productIds = Array.from(new Set(
      [...soItems, ...invoiceItems].map((i) => i.product_id).filter((id): id is string => !!id)
    ));
    const categoryByProductId = new Map<string, string>();
    if (productIds.length > 0) {
      const productRows = await fetchAllSupabaseRows<{ id: string; category: string | null }>(
        () => supabase.from('products').select('id, category').in('id', productIds)
      );
      productRows.forEach((p) => { categoryByProductId.set(p.id, p.category || 'Uncategorized'); });
    }

    const buildBreakdown = (items: { product_id: string | null; total: number | null }[]) => {
      const byCategory = new Map<string, number>();
      items.forEach((item) => {
        const category = (item.product_id && categoryByProductId.get(item.product_id)) || 'Uncategorized';
        byCategory.set(category, (byCategory.get(category) || 0) + (Number(item.total) || 0));
      });
      return Array.from(byCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
    };

    const soItemsByOrder = new Map<string, typeof soItems>();
    soItems.forEach((i) => {
      const list = soItemsByOrder.get(i.sales_order_id) || [];
      list.push(i);
      soItemsByOrder.set(i.sales_order_id, list);
    });
    const invoiceItemsByInvoice = new Map<string, typeof invoiceItems>();
    invoiceItems.forEach((i) => {
      const list = invoiceItemsByInvoice.get(i.invoice_id) || [];
      list.push(i);
      invoiceItemsByInvoice.set(i.invoice_id, list);
    });

    entries.forEach((e) => {
      if (!e.storefrontPhoto) {
        const p = photoByName.get(norm(e.name));
        if (p) e.storefrontPhoto = p;
      }
      if ((e.type === 'invoice' || e.type === 'delivery') && e.salesOrderId) {
        const soAt = soCreatedById.get(e.salesOrderId);
        if (soAt) {
          const diff = e.timestamp.getTime() - new Date(soAt).getTime();
          e.daysToConvert = Math.max(0, Math.round(diff / (24 * 60 * 60 * 1000)));
        }
        if (e.type === 'invoice') {
          e.salesOrderAmount = soTotalById.get(e.salesOrderId);
        }
      }
      if (e.type === 'sales_order') {
        const items = soItemsByOrder.get(e.id);
        if (items && items.length > 0) e.categoryBreakdown = buildBreakdown(items);
      }
      if (e.type === 'invoice') {
        const items = invoiceItemsByInvoice.get(e.id);
        if (items && items.length > 0) e.categoryBreakdown = buildBreakdown(items);
      }
    });

    // 4. A sales order that's (partially or fully) invoiced within this same
    // batch shouldn't also show as its own activity — keep only the invoice(s).
    const invoicedSalesOrderIds = new Set(
      entries.filter((e) => e.type === 'invoice' && e.salesOrderId).map((e) => e.salesOrderId!)
    );
    if (invoicedSalesOrderIds.size > 0) {
      const kept = entries.filter((e) => !(e.type === 'sales_order' && invoicedSalesOrderIds.has(e.id)));
      entries.splice(0, entries.length, ...kept);
    }
  };

  const fetchDailyLogs = async (dateStr: string) => {
    setLoading(true);
    setTimeRoutes([]);
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

      const routesForDay: TimeRoutePath[] = [];

      // Process time tracking data
      timeData?.forEach((time) => {
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

        const visitPoints: TimeRoutePath['points'] = [];
        const addPoint = (latitude?: number | null, longitude?: number | null, timestamp?: Date) => {
          if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
            return;
          }
          if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return;
          }
          if (visitPoints.length > 0) {
            const last = visitPoints[visitPoints.length - 1];
            if (Math.abs(last.latitude - latitude) < 1e-6 && Math.abs(last.longitude - longitude) < 1e-6) {
              return;
            }
          }
          visitPoints.push({
            latitude,
            longitude,
            recordedAt: timestamp || new Date(),
          });
        };

        addPoint(time.clock_in_latitude, time.clock_in_longitude, new Date(time.clock_in_time));

        const relatedEntries = entries
          .filter((entry) => entry.userId === time.user_id)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        relatedEntries.forEach((entry) => {
          addPoint(entry.latitude, entry.longitude, entry.timestamp);
        });

        if (time.clock_out_time) {
          addPoint(time.clock_out_latitude, time.clock_out_longitude, new Date(time.clock_out_time));
        }

        if (visitPoints.length >= 2) {
          const color = ROUTE_COLORS[routesForDay.length % ROUTE_COLORS.length];
          const labelUser = user?.name || 'Field Agent';
          const routeLabel = `${labelUser} • ${new Date(time.clock_in_time).toLocaleTimeString()}${time.clock_out_time ? ` - ${new Date(time.clock_out_time).toLocaleTimeString()}` : ''}`;
          routesForDay.push({
            id: time.id,
            label: routeLabel,
            color,
            points: visitPoints,
          });
        }
      });

      setTimeRoutes(routesForDay);

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
        .select('id, reason, latitude, longitude, created_at, agency_id, user_id, store_front_photo, customer_name, potential_customer')
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
          name: visit.customer_name || visit.potential_customer || 'Non-productive Visit',
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
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by, total')
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
        const amount = Number(order.total) || 0;
        entries.push({
          id: order.id,
          type: 'sales_order',
          name: order.customer_name,
          latitude: order.latitude,
          longitude: order.longitude,
          timestamp: new Date(order.created_at),
          details: `Sales Order: LKR ${amount.toLocaleString()}`,
          agencyName: agency?.name || 'Unknown Agency',
          userId: order.created_by,
          userName: user?.name || 'Unknown User',
          amount
        });
      });

      // Fetch invoices
      let invoiceQuery = supabase
        .from('invoices')
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by, total, sales_order_id')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        invoiceQuery = invoiceQuery.eq('created_by', userFilter);
      }

      const invoices = await fetchAllSupabaseRows<any>(() => invoiceQuery);

      invoices?.forEach(invoice => {
        const user = users.find(u => u.id === invoice.created_by);
        const agency = agencies.find(a => a.id === invoice.agency_id);
        const amount = Number(invoice.total) || 0;
        entries.push({
          id: invoice.id,
          type: 'invoice',
          name: invoice.customer_name,
          latitude: invoice.latitude,
          longitude: invoice.longitude,
          timestamp: new Date(invoice.created_at),
          details: `Invoice: LKR ${amount.toLocaleString()}`,
          agencyName: agency?.name || 'Unknown Agency',
          userId: invoice.created_by,
          userName: user?.name || 'Unknown User',
          amount,
          salesOrderId: invoice.sales_order_id || undefined
        });
      });

      // Fetch deliveries (joined to invoice for customer name, value and originating sales order)
      let deliveryQuery = supabase
        .from('deliveries')
        .select('id, status, received_by_name, delivery_notes, delivered_at, delivery_latitude, delivery_longitude, agency_id, invoices(customer_name, total, sales_order_id)')
        .eq('agency_id', agencyFilter)
        .gte('delivered_at', startDate)
        .lte('delivered_at', endDate)
        .not('delivery_latitude', 'is', null)
        .not('delivery_longitude', 'is', null);

      const { data: deliveries } = await deliveryQuery;

      deliveries?.forEach((delivery: any) => {
        const agency = agencies.find(a => a.id === delivery.agency_id);
        const invoiceAmount = delivery.invoices?.total != null ? Number(delivery.invoices.total) : undefined;
        entries.push({
          id: `delivery-${delivery.id}`,
          type: 'delivery',
          name: delivery.invoices?.customer_name || delivery.received_by_name || 'Delivery',
          latitude: delivery.delivery_latitude,
          longitude: delivery.delivery_longitude,
          timestamp: new Date(delivery.delivered_at),
          details: `Delivered${delivery.received_by_name ? ` to ${delivery.received_by_name}` : ''}${delivery.status ? ` (${delivery.status})` : ''}${invoiceAmount !== undefined ? ` — Invoice: LKR ${invoiceAmount.toLocaleString()}` : ''}`,
          agencyName: agency?.name || 'Unknown Agency',
          amount: invoiceAmount,
          salesOrderId: delivery.invoices?.sales_order_id || undefined
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

      // Attach customer photos + days-to-convert before sorting
      await enrichEntries(entries, agencyFilter);

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
    setTimeRoutes([]);
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

      const routesForRange: TimeRoutePath[] = [];

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

        const routePoints: TimeRoutePath['points'] = [];
        const appendPoint = (latitude?: number | null, longitude?: number | null, recordedAt?: Date) => {
          if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return;
          if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
          if (routePoints.length > 0) {
            const last = routePoints[routePoints.length - 1];
            if (Math.abs(last.latitude - latitude) < 1e-6 && Math.abs(last.longitude - longitude) < 1e-6) {
              return;
            }
          }
          routePoints.push({ latitude, longitude, recordedAt: recordedAt || new Date() });
        };

        appendPoint(time.clock_in_latitude, time.clock_in_longitude, new Date(time.clock_in_time));

        const relatedEntries = entries
          .filter((entry) => entry.userId === time.user_id)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        relatedEntries.forEach((entry) => {
          appendPoint(entry.latitude, entry.longitude, entry.timestamp);
        });

        if (time.clock_out_time) {
          appendPoint(time.clock_out_latitude, time.clock_out_longitude, new Date(time.clock_out_time));
        }

        if (routePoints.length >= 2) {
          const color = ROUTE_COLORS[routesForRange.length % ROUTE_COLORS.length];
          const labelUser = user?.name || 'Field Agent';
          const routeLabel = `${labelUser} • ${new Date(time.date).toLocaleDateString()} ${new Date(time.clock_in_time).toLocaleTimeString()}${time.clock_out_time ? ` - ${new Date(time.clock_out_time).toLocaleTimeString()}` : ''}`;
          routesForRange.push({
            id: `${time.id}-${time.date}`,
            label: routeLabel,
            color,
            points: routePoints,
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
        .select('id, reason, latitude, longitude, created_at, agency_id, user_id, store_front_photo, customer_name, potential_customer')
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
          name: visit.customer_name || visit.potential_customer || 'Non-productive Visit',
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
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by, total')
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
        const amount = Number(order.total) || 0;
        entries.push({
          id: order.id,
          type: 'sales_order',
          name: order.customer_name,
          latitude: order.latitude,
          longitude: order.longitude,
          timestamp: new Date(order.created_at),
          details: `Sales Order: LKR ${amount.toLocaleString()}`,
          agencyName: agency?.name || 'Unknown Agency',
          userId: order.created_by,
          userName: user?.name || 'Unknown User',
          amount
        });
      });

      let invoiceQuery = supabase
        .from('invoices')
        .select('id, customer_name, latitude, longitude, created_at, agency_id, created_by, total, sales_order_id')
        .eq('agency_id', agencyFilter)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (userFilter) {
        invoiceQuery = invoiceQuery.eq('created_by', userFilter);
      }

      const invoices = await fetchAllSupabaseRows<any>(() => invoiceQuery);

      invoices?.forEach(invoice => {
        const user = users.find(u => u.id === invoice.created_by);
        const agency = agencies.find(a => a.id === invoice.agency_id);
        const amount = Number(invoice.total) || 0;
        entries.push({
          id: invoice.id,
          type: 'invoice',
          name: invoice.customer_name,
          latitude: invoice.latitude,
          longitude: invoice.longitude,
          timestamp: new Date(invoice.created_at),
          details: `Invoice: LKR ${amount.toLocaleString()}`,
          agencyName: agency?.name || 'Unknown Agency',
          userId: invoice.created_by,
          userName: user?.name || 'Unknown User',
          amount,
          salesOrderId: invoice.sales_order_id || undefined
        });
      });

      // Fetch deliveries for the range (joined to invoice for customer name, value and originating sales order)
      let deliveryQuery = supabase
        .from('deliveries')
        .select('id, status, received_by_name, delivery_notes, delivered_at, delivery_latitude, delivery_longitude, agency_id, invoices(customer_name, total, sales_order_id)')
        .eq('agency_id', agencyFilter)
        .gte('delivered_at', startDateTime)
        .lte('delivered_at', endDateTime)
        .not('delivery_latitude', 'is', null)
        .not('delivery_longitude', 'is', null);

      const { data: deliveries } = await deliveryQuery;

      deliveries?.forEach((delivery: any) => {
        const agency = agencies.find(a => a.id === delivery.agency_id);
        const invoiceAmount = delivery.invoices?.total != null ? Number(delivery.invoices.total) : undefined;
        entries.push({
          id: `delivery-${delivery.id}`,
          type: 'delivery',
          name: delivery.invoices?.customer_name || delivery.received_by_name || 'Delivery',
          latitude: delivery.delivery_latitude,
          longitude: delivery.delivery_longitude,
          timestamp: new Date(delivery.delivered_at),
          details: `Delivered${delivery.received_by_name ? ` to ${delivery.received_by_name}` : ''}${delivery.status ? ` (${delivery.status})` : ''}${invoiceAmount !== undefined ? ` — Invoice: LKR ${invoiceAmount.toLocaleString()}` : ''}`,
          agencyName: agency?.name || 'Unknown Agency',
          amount: invoiceAmount,
          salesOrderId: delivery.invoices?.sales_order_id || undefined
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

      // Attach customer photos + days-to-convert before sorting
      await enrichEntries(entries, agencyFilter);

      // Sort entries by timestamp and assign order numbers
      entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      entries.forEach((entry, index) => {
        entry.orderNumber = index + 1;
      });

      setLogEntries(entries);
      setTimeRoutes(routesForRange);
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
      case 'delivery': return Truck;
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
      case 'delivery': return '#0EA5E9'; // Sky blue for deliveries
      default: return '#6B7280';
    }
  };

  // Totals for the selected day/range, derived from the loaded entries
  const summary = {
    salesOrderValue: logEntries
      .filter(e => e.type === 'sales_order')
      .reduce((sum, e) => sum + (e.amount || 0), 0),
    invoiceValue: logEntries
      .filter(e => e.type === 'invoice')
      .reduce((sum, e) => sum + (e.amount || 0), 0),
    // count of distinct customers delivered to
    deliveredCustomers: new Set(
      logEntries.filter(e => e.type === 'delivery').map(e => e.name)
    ).size,
    collectionValue: logEntries
      .filter(e => e.type === 'collection')
      .reduce((sum, e) => {
        // Collection amount is embedded in details: "Collection: LKR 1,234 (...)"
        const match = e.details?.match(/LKR\s([\d,]+)/);
        return sum + (match ? Number(match[1].replace(/,/g, '')) : 0);
      }, 0),
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      
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

            {/* Day summary cards */}
            {selectedDate && logEntries.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                      <ShoppingCart className="h-5 w-5 text-gray-900" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Sales Orders</div>
                      <div className="text-lg font-bold">LKR {summary.salesOrderValue.toLocaleString()}</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
                      <Receipt className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Invoices</div>
                      <div className="text-lg font-bold">LKR {summary.invoiceValue.toLocaleString()}</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-sky-100">
                      <Truck className="h-5 w-5 text-sky-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Delivered Customers</div>
                      <div className="text-lg font-bold">{summary.deliveredCustomers}</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-100">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Collections</div>
                      <div className="text-lg font-bold">LKR {summary.collectionValue.toLocaleString()}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
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
                        const isSelected = selectedEntryId === entry.id;
                        return (
                          <div
                            key={entry.id}
                            onClick={() => setSelectedEntryId(isSelected ? null : entry.id)}
                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                          >
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
                            {entry.storefrontPhoto && (
                              <div 
                                className="relative cursor-pointer group flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); handleImageClick(entry.storefrontPhoto!, entry.name, entry.type); }}
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
                                {entry.storefrontPhoto && (
                                  <Badge variant="secondary" className="text-xs">
                                    📷 Photo
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-600">
                                <div>{entry.timestamp.toLocaleTimeString()}</div>
                                {entry.details && <div>{entry.details}</div>}
                                {entry.type === 'invoice' && entry.salesOrderAmount !== undefined && (
                                  <div>Sales Order: LKR {entry.salesOrderAmount.toLocaleString()}</div>
                                )}
                                {entry.categoryBreakdown && entry.categoryBreakdown.length > 0 && (
                                  <div>
                                    {entry.categoryBreakdown.map(c => `${c.category}: LKR ${c.amount.toLocaleString()}`).join(' · ')}
                                  </div>
                                )}
                                {user.role === 'superuser' && entry.userName && <div>User: {entry.userName}</div>}
                              </div>
                            </div>
                            {(entry.type === 'invoice' || entry.type === 'delivery') && entry.daysToConvert !== undefined && (
                              <div className="text-right shrink-0" title={`Days from the sales order to this ${entry.type}`}>
                                <div className="text-sm font-bold text-indigo-600">{entry.daysToConvert}d</div>
                                <div className="text-[10px] text-gray-500 leading-tight">SO → {entry.type === 'delivery' ? 'delivery' : 'invoice'}</div>
                              </div>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEntryToDelete(entry); }}
                                className="shrink-0 text-red-500 hover:text-red-700 p-1"
                                title="Delete this activity"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
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
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-sky-500"></div>
                <span className="text-sm">Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                <span className="text-sm">Collection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded-full bg-blue-600"></div>
                <span className="text-sm">Tracked Route</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Numbers on the map match the visit sequence in the activities list. Click an activity to highlight it here.</p>
          </CardHeader>
          <CardContent>
              <LeafletMap
                locations={logEntries
                  .filter(entry => isWithinSriLanka(entry.latitude, entry.longitude))
                  .map(entry => ({
                  id: entry.id,
                  type: entry.type,
                name: `${entry.orderNumber}. ${entry.name}`,
                latitude: entry.latitude,
                longitude: entry.longitude,
                timestamp: entry.timestamp,
                details: entry.details,
                agencyName: entry.agencyName,
                orderNumber: entry.orderNumber
              }))}
              routes={timeRoutes}
              height="600px"
              selectedId={selectedEntryId}
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
                  const isSelected = selectedEntryId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntryId(isSelected ? null : entry.id)}
                      className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
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
                      {entry.storefrontPhoto && (
                        <div 
                          className="relative cursor-pointer group flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); handleImageClick(entry.storefrontPhoto!, entry.name, entry.type); }}
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
                          {entry.storefrontPhoto && (
                            <Badge variant="secondary" className="text-xs">
                              📷 Photo
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>{entry.details}</div>
                          {entry.type === 'invoice' && entry.salesOrderAmount !== undefined && (
                            <div>Sales Order: LKR {entry.salesOrderAmount.toLocaleString()}</div>
                          )}
                          {entry.categoryBreakdown && entry.categoryBreakdown.length > 0 && (
                            <div>
                              {entry.categoryBreakdown.map(c => `${c.category}: LKR ${c.amount.toLocaleString()}`).join(' · ')}
                            </div>
                          )}
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
                        {(entry.type === 'invoice' || entry.type === 'delivery') && entry.daysToConvert !== undefined && (
                          <div className="mt-1" title={`Days from the sales order to this ${entry.type}`}>
                            <span className="text-sm font-bold text-indigo-600">{entry.daysToConvert}d</span>
                            <span className="text-[10px] text-gray-500 ml-1">SO → {entry.type === 'delivery' ? 'delivery' : 'invoice'}</span>
                          </div>
                        )}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEntryToDelete(entry); }}
                          className="shrink-0 text-red-500 hover:text-red-700 p-1"
                          title="Delete this activity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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

      {/* Delete activity confirmation (superuser only) */}
      <AlertDialog open={!!entryToDelete} onOpenChange={(open) => { if (!open) setEntryToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity</AlertDialogTitle>
            <AlertDialogDescription>
              {entryToDelete && (
                <>
                  This permanently deletes the <strong>{entryToDelete.type.replace('_', ' ')}</strong> activity
                  {entryToDelete.name ? <> for <strong>{entryToDelete.name}</strong></> : null}
                  {(entryToDelete.type === 'invoice' || entryToDelete.type === 'sales_order' || entryToDelete.type === 'collection')
                    ? ' and its related line items/allocations.' : '.'} This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (entryToDelete) deleteEntry(entryToDelete); }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DailyLogReport;
