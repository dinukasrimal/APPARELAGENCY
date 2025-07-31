import { useState } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BarChart3, Calendar, TrendingUp, FileText } from 'lucide-react';
import EnhancedReports from './EnhancedReports';
import DailyLogReport from './DailyLogReport';
import CategorySizeInvoiceReport from './CategorySizeInvoiceReport';

interface ReportsProps {
  user: User;
  onBack: () => void;
}

type ReportType = 'main' | 'enhanced' | 'daily-log' | 'category-size';

const Reports = ({ user, onBack }: ReportsProps) => {
  const [activeReport, setActiveReport] = useState<ReportType>('main');

  const reportOptions = [
    {
      id: 'enhanced',
      title: 'Enhanced Daily Report',
      description: 'Comprehensive analytics with sales metrics, customer onboarding, and performance insights',
      icon: TrendingUp,
      color: 'bg-blue-500',
    },
    {
      id: 'daily-log',
      title: 'Daily Activity Log',
      description: 'Track daily activities with GPS coordinates, timestamps, and photo documentation',
      icon: Calendar,
      color: 'bg-green-500',
    },
    {
      id: 'category-size',
      title: 'Category & Size Invoice Report',
      description: 'Invoice analysis by product category and size with date and customer filtering',
      icon: BarChart3,
      color: 'bg-purple-500',
    },
  ];

  const renderActiveReport = () => {
    switch (activeReport) {
      case 'enhanced':
        return <EnhancedReports user={user} onBack={() => setActiveReport('main')} />;
      case 'daily-log':
        return <DailyLogReport user={user} onBack={() => setActiveReport('main')} />;
      case 'category-size':
        return <CategorySizeInvoiceReport user={user} onBack={() => setActiveReport('main')} />;
      default:
        return null;
    }
  };

  if (activeReport !== 'main') {
    return renderActiveReport();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Access comprehensive business reports and insights</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportOptions.map((report) => (
          <Card 
            key={report.id} 
            className="cursor-pointer hover:shadow-lg transition-shadow duration-200 group"
            onClick={() => setActiveReport(report.id as ReportType)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${report.color} text-white group-hover:scale-110 transition-transform duration-200`}>
                  <report.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                    {report.title}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-gray-600 leading-relaxed">
                {report.description}
              </CardDescription>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4 w-full group-hover:bg-blue-50 group-hover:border-blue-200"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Report
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <strong>Enhanced Daily Report:</strong> Best for tracking overall business performance and KPI monitoring.
          </div>
          <div>
            <strong>Daily Activity Log:</strong> Perfect for field sales tracking and activity verification.
          </div>
          <div>
            <strong>Category & Size Report:</strong> Ideal for inventory insights and sales analysis by product attributes.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;