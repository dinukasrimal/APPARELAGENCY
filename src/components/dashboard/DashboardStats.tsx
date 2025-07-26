
import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgency } from '@/hooks/useAgency';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  ShoppingCart, 
  Package, 
  MapPin,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import DashboardMap from './DashboardMap';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStatsProps {
  user: User;
}

const DashboardStats = ({ user }: DashboardStatsProps) => {
  const { agency } = useAgency(user.agencyId);
  
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalSalesOrders: 0,
    totalProducts: 0,
    todayVisits: 0
  });

  useEffect(() => {
    fetchStats();
  }, [user.role, user.agencyId]);

  const fetchStats = async () => {
    try {
      if (user.role === 'superuser') {
        // For superusers, fetch data across all agencies
        await fetchSuperuserStats();
      } else {
        // For regular users, fetch agency-specific data
        await fetchAgencyStats();
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchSuperuserStats = async () => {
    try {
      // Fetch customer count across all agencies
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      // Fetch sales orders count across all agencies
      const { count: salesCount } = await supabase
        .from('sales_orders')
        .select('*', { count: 'exact', head: true });

      // Fetch products count
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Fetch today's visits across all agencies
      const today = new Date().toISOString().split('T')[0];
      const { count: visitCount } = await supabase
        .from('non_productive_visits')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00');

      setStats({
        totalCustomers: customerCount || 0,
        totalSalesOrders: salesCount || 0,
        totalProducts: productCount || 0,
        todayVisits: visitCount || 0
      });
    } catch (error) {
      console.error('Error fetching superuser stats:', error);
    }
  };

  const fetchAgencyStats = async () => {
    try {
      // Fetch customer count for specific agency
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', user.agencyId);

      // Fetch sales orders count for specific agency
      const { count: salesCount } = await supabase
        .from('sales_orders')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', user.agencyId);

      // Fetch products count (same for all users)
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Fetch today's visits for specific agency
      const today = new Date().toISOString().split('T')[0];
      const { count: visitCount } = await supabase
        .from('non_productive_visits')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', user.agencyId)
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00');

      setStats({
        totalCustomers: customerCount || 0,
        totalSalesOrders: salesCount || 0,
        totalProducts: productCount || 0,
        todayVisits: visitCount || 0
      });
    } catch (error) {
      console.error('Error fetching agency stats:', error);
    }
  };

  const statCards = [
    {
      title: user.role === 'superuser' ? 'Total Customers (All Agencies)' : 'Total Customers',
      value: stats.totalCustomers,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: user.role === 'superuser' ? 'Sales Orders (All Agencies)' : 'Sales Orders',
      value: stats.totalSalesOrders,
      icon: ShoppingCart,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: user.role === 'superuser' ? "Today's Visits (All Agencies)" : "Today's Visits",
      value: stats.todayVisits,
      icon: MapPin,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Modern Welcome Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
        <div className="relative p-6 sm:p-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Welcome back, {user.role === 'superuser' ? user.name : (agency?.name || user.agencyName?.replace(/\s+manager\s*$/i, '') || user.name)}!
          </h1>
          <p className="text-lg text-slate-600 font-medium">
            {user.role === 'superuser' ? 'System overview across all agencies' : 'Agency dashboard'}
          </p>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="group bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl rounded-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-600 mb-2 group-hover:text-slate-700 transition-colors duration-200">{stat.title}</p>
                    <p className="text-3xl font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-200">{stat.value}</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${stat.bgColor} group-hover:scale-110 transition-all duration-300 shadow-md`}>
                    <Icon className={`h-8 w-8 ${stat.color} group-hover:scale-110 transition-transform duration-300`} />
                  </div>
                </div>
                
                {/* Modern progress indicator */}
                <div className="mt-4 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${stat.color.replace('text-', 'bg-')} rounded-full transition-all duration-1000 ease-out`}
                    style={{
                      width: `${Math.min((stat.value / 100) * 100, 100)}%`,
                      animationDelay: `${index * 200}ms`
                    }}
                  ></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dashboard Map */}
      <DashboardMap user={user} />
    </div>
  );
};

export default DashboardStats;
