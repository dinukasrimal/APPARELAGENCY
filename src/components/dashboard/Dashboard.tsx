import { useState } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import DashboardStats from './DashboardStats';
import DashboardMapLeaflet from './DashboardMapLeaflet';
import CustomerManagement from '@/components/customers/CustomerManagement';
import ProductCatalogWithCategories from '@/components/products/ProductCatalogWithCategories';
import ProductSidebarView from '@/components/products/ProductSidebarView';
import SalesOrders from '@/components/sales/SalesOrders';
import PurchaseOrders from '@/components/purchase/PurchaseOrders';
import Inventory from '@/components/inventory/Inventory';
import NonProductiveVisits from '@/components/visits/NonProductiveVisits';
import TimeTracking from '@/components/visits/TimeTracking';
import QuarterlyTargetsManagement from '@/components/targets/QuarterlyTargetsManagement';
import GRNUpload from '@/components/grn/GRNUpload';
import GRNAcceptance from '@/components/grn/GRNAcceptance';
import UserManagement from '@/components/admin/UserManagement';
import SimpleCompanyReturns from '@/components/returns/SimpleCompanyReturns';
import DailyLogReport from '@/components/reports/DailyLogReport';
import EnhancedReports from '@/components/reports/EnhancedReports';
import DuplicatePreventionCustomerManagement from '@/components/customers/DuplicatePreventionCustomerManagement';
import { GRN } from '@/types/grn';
import Collections from '@/components/collections/Collections';
import Assets from '@/components/assets/Assets';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard = ({ user, onLogout }: DashboardProps) => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [grns, setGrns] = useState<GRN[]>([]);

  const handleGRNCreated = (grn: GRN) => {
    setGrns(prev => [...prev, grn]);
  };

  const handleGRNProcessed = (grnId: string, action: 'accepted' | 'rejected', reason?: string) => {
    setGrns(prev => prev.map(grn => 
      grn.id === grnId 
        ? { 
            ...grn, 
            status: action, 
            processedAt: new Date(),
            processedBy: user.name,
            rejectionReason: reason 
          }
        : grn
    ));
  };

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'customers':
        return <DuplicatePreventionCustomerManagement user={user} />;
      case 'assets':
        return <Assets user={user} />;
      case 'products':
        return <ProductSidebarView user={user} />;
      case 'sales':
        return <SalesOrders user={user} />;
      case 'purchase':
        return <PurchaseOrders user={user} />;
      case 'inventory':
        return <Inventory user={user} />;
      case 'non-productive-visits':
        return <NonProductiveVisits user={user} />;
      case 'time-tracking':
        return <TimeTracking user={user} />;
      case 'company-returns':
        return <SimpleCompanyReturns user={user} />;
      case 'targets':
        return <QuarterlyTargetsManagement user={user} />;
      case 'grn-upload':
        return <GRNUpload user={user} onGRNCreated={handleGRNCreated} />;
      case 'grn-accept':
        return <GRNAcceptance user={user} grns={grns} onGRNProcessed={handleGRNProcessed} />;
      case 'user-management':
        return <UserManagement user={user} />;
      case 'reports':
        return <EnhancedReports user={user} />;
      case 'daily-log':
        return <DailyLogReport user={user} />;
      case 'collections':
        return <Collections user={user} />;
      default:
        return (
          <div className="space-y-6">
            <DashboardStats user={user} />
            <DashboardMapLeaflet user={user} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex w-full">
      <Sidebar 
        user={user}
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col">
        {/* Modern Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 shadow-sm px-3 md:px-6 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {activeModule.charAt(0).toUpperCase() + activeModule.slice(1).replace('-', ' ')}
              </h1>
            </div>
            
            <Button 
              variant="outline" 
              onClick={onLogout}
              className="group flex items-center gap-2 text-sm font-medium bg-white/90 border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all duration-200"
              size="sm"
            >
              <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
              Logout
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {renderActiveModule()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
