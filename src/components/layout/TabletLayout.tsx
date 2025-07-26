import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';

interface TabletLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function TabletLayout({ children, sidebar }: TabletLayoutProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Collapsed Sidebar */}
      <div className="h-full bg-background border-r w-16 flex flex-col items-center py-2">
        {/* Menu Toggle Button */}
        <button
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="p-2 hover:bg-accent rounded-md mb-4"
          aria-label="Toggle menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        {/* Icons Only View (when collapsed) */}
        <div className={cn(
          'flex flex-col items-center space-y-4',
          isSidebarExpanded && 'hidden'
        )}>
          {React.Children.map(sidebar, (child) => {
            if (React.isValidElement(child)) {
              // Extract and render only the icon from each sidebar item
              const icon = child.props.icon || child.props.children?.props?.icon;
              if (icon) {
                return (
                  <div className="p-2 hover:bg-accent rounded-md cursor-pointer">
                    {icon}
                  </div>
                );
              }
            }
            return null;
          })}
        </div>
      </div>

      {/* Expanded Sidebar (Overlay) */}
      {isSidebarExpanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarExpanded(false)}
          />
          
          {/* Expanded Menu */}
          <div className="fixed left-0 top-0 h-full w-64 bg-background border-r z-50 p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Menu</h2>
              <button
                onClick={() => setIsSidebarExpanded(false)}
                className="p-2 hover:bg-accent rounded-md"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
            {sidebar}
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
} 