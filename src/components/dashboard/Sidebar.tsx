import { useState } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgency } from '@/hooks/useAgency';
import {
  BarChart3,
  Users,
  Package,
  ShoppingCart,
  Truck,
  Warehouse,
  Target,
  FileText,
  Upload,
  CheckSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCog,
  MapPin,
  Clock,
  RotateCcw,
  BarChart,
  AlertTriangle,
  DollarSign,
  Image
} from 'lucide-react';

interface SidebarProps {
  user: User;
  activeModule: string;
  onModuleChange: (module: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

type ActiveModule = 'dashboard' | 'customers' | 'products' | 'sales' | 'purchase' | 'inventory' | 'targets' | 'reports' | 'grn-upload' | 'grn-accept' | 'user-management' | 'non-productive-visits' | 'time-tracking' | 'company-returns' | 'assets';

const Sidebar = ({ user, activeModule, onModuleChange, isOpen, onToggle }: SidebarProps) => {
  const { agency } = useAgency(user.agencyId);
  
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['agency', 'superuser', 'agent'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['agency', 'superuser', 'agent'] },
    { id: 'assets', label: 'Assets', icon: Image, roles: ['agency', 'superuser', 'agent'] },
    { id: 'products', label: 'Products', icon: Package, roles: ['agency', 'superuser', 'agent'] },
    { id: 'sales', label: 'Sales', icon: ShoppingCart, roles: ['agency', 'superuser', 'agent'] },
    { id: 'purchase', label: 'Purchase', icon: Truck, roles: ['agency', 'superuser', 'agent'] },
    { id: 'inventory', label: 'Inventory', icon: Warehouse, roles: ['agency', 'superuser', 'agent'] },
    { id: 'non-productive-visits', label: 'Non-Productive Visits', icon: AlertTriangle, roles: ['agency', 'agent', 'superuser'] },
    { id: 'time-tracking', label: 'Time Tracking', icon: Clock, roles: ['agency', 'agent'] },
    { id: 'company-returns', label: 'Company Returns', icon: RotateCcw, roles: ['agency', 'superuser', 'agent'] },
    { id: 'targets', label: 'Targets', icon: Target, roles: ['agency', 'superuser'] },
    { id: 'grn-upload', label: 'GRN Upload', icon: Upload, roles: ['superuser'] },
    { id: 'grn-accept', label: 'GRN Acceptance', icon: CheckSquare, roles: ['agency', 'agent'] },
    { id: 'user-management', label: 'User Management', icon: UserCog, roles: ['superuser'] },
    {
      id: 'reports',
      label: 'Enhanced Reports',
      icon: BarChart,
      roles: ['superuser', 'agency', 'agent'],
    },
    {
      id: 'daily-log',
      label: 'Daily Log Report',
      icon: MapPin,
      roles: ['superuser', 'agency', 'agent'],
    },
    { id: 'collections', label: 'Collections', icon: DollarSign, roles: ['agency', 'superuser', 'agent'] },
  ];

  const filteredMenuItems = sidebarItems.filter(item => 
    item.roles.includes(user.role)
  );

  const handleMenuItemClick = (itemId: string) => {
    onModuleChange(itemId);
  };

  return (
    <div className={cn(
      "bg-white/90 backdrop-blur-sm border-r border-white/20 shadow-xl flex flex-col transition-all duration-300",
      isOpen ? "w-64" : "w-16"
    )}>
      {/* Modern Header */}
      <div className="p-4 border-b border-white/20 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          {isOpen && (
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Sales Portal</h1>
              <p className="text-sm text-slate-600 font-medium">{agency?.name || user.agencyName?.replace(/\s+manager\s*$/i, '') || 'System Admin'}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="shrink-0 group h-10 w-10 rounded-xl bg-white/80 border border-white/40 hover:bg-white hover:border-white/60 shadow-md transition-all duration-200"
          >
            {isOpen ? (
              <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
            ) : (
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            )}
          </Button>
        </div>
      </div>

      {/* Modern Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {filteredMenuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "group w-full justify-start transition-all duration-200 rounded-xl font-medium",
                !isOpen && "px-2",
                isActive 
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:from-blue-600 hover:to-purple-600" 
                  : "text-slate-600 hover:bg-white/80 hover:text-slate-800 hover:shadow-md border border-transparent hover:border-white/40"
              )}
              onClick={() => handleMenuItemClick(item.id)}
              style={{
                animationDelay: `${index * 50}ms`
              }}
            >
              <div className={cn(
                "flex items-center transition-all duration-200",
                isActive ? "scale-110" : "group-hover:scale-105"
              )}>
                <Icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isOpen && "mr-3",
                  isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700"
                )} />
                {isOpen && (
                  <span className="transition-all duration-200 group-hover:translate-x-1">
                    {item.label}
                  </span>
                )}
              </div>
            </Button>
          );
        })}
      </nav>

      {/* Modern User Info */}
      {isOpen && (
        <div className="p-4 border-t border-white/20 bg-gradient-to-r from-slate-50 to-blue-50">
          <div className="flex items-center space-x-3 p-3 bg-white/80 rounded-2xl border border-white/40 shadow-md">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user.name}
              </p>
              <p className="text-xs text-slate-500 truncate font-medium">
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
