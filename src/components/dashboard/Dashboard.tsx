import { useState, lazy, Suspense, memo } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import DashboardStats from './DashboardStats';
import DashboardMapLeaflet from './DashboardMapLeaflet';

// Lazy load heavy components to improve initial load time
const CustomerManagement = lazy(() => import('@/components/customers/DuplicatePreventionCustomerManagement'));
const ProductSidebarView = lazy(() => import('@/components/products/ProductSidebarView'));
const SalesOrders = lazy(() => import('@/components/sales/SalesOrders'));
const PurchaseOrders = lazy(() => import('@/components/purchase/PurchaseOrders'));
const ExternalInventory = lazy(() => import('@/components/inventory/ExternalInventory'));
const NonProductiveVisits = lazy(() => import('@/components/visits/NonProductiveVisits'));
const TimeTracking = lazy(() => import('@/components/visits/TimeTracking'));
const QuarterlyTargetsManagement = lazy(() => import('@/components/targets/QuarterlyTargetsManagement'));
const UserManagement = lazy(() => import('@/components/admin/UserManagement'));
const SimpleCompanyReturns = lazy(() => import('@/components/returns/SimpleCompanyReturns'));
const Reports = lazy(() => import('@/components/reports/Reports'));
const Collections = lazy(() => import('@/components/collections/Collections'));
const Assets = lazy(() => import('@/components/assets/Assets'));
const ReturnChequesLodge = lazy(() => import('@/components/cheques/ReturnChequesLodge'));

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard = memo(({ user, onLogout }: DashboardProps) => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Loading component for lazy-loaded modules
  const ModuleLoader = () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-600">Loading module...</span>
    </div>
  );

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'customers':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <CustomerManagement user={user} />
          </Suspense>
        );
      case 'assets':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <Assets user={user} />
          </Suspense>
        );
      case 'products':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <ProductSidebarView user={user} />
          </Suspense>
        );
      case 'sales':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <SalesOrders user={user} />
          </Suspense>
        );
      case 'purchase':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <PurchaseOrders user={user} />
          </Suspense>
        );
      case 'inventory':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <ExternalInventory user={user} />
          </Suspense>
        );
      case 'non-productive-visits':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <NonProductiveVisits user={user} />
          </Suspense>
        );
      case 'time-tracking':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <TimeTracking user={user} />
          </Suspense>
        );
      case 'company-returns':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <SimpleCompanyReturns user={user} />
          </Suspense>
        );
      case 'targets':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <QuarterlyTargetsManagement user={user} />
          </Suspense>
        );
      case 'user-management':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <UserManagement user={user} />
          </Suspense>
        );
      case 'reports':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <Reports user={user} onBack={() => setActiveModule('dashboard')} />
          </Suspense>
        );
      case 'collections':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <Collections user={user} />
          </Suspense>
        );
      case 'return-cheques':
        return (
          <Suspense fallback={<ModuleLoader />}>
            <ReturnChequesLodge user={user} onBack={() => setActiveModule('dashboard')} />
          </Suspense>
        );
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
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;
