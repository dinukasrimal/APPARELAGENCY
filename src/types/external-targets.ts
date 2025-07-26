// TypeScript interfaces for external targets and invoices integration

export interface ExternalSalesTarget {
  id: string;
  customer_name: string; // Agency name
  target_year: number;
  target_months: string; // e.g., "Q1", "Jan-Mar", etc.
  base_year?: number;
  target_data?: any; // JSON data
  initial_total_value: number;
  adjusted_total_value: number;
  percentage_increase: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface ExternalInvoice {
  id: string;
  name?: string;
  partner_name: string; // Agency name
  date_order: Date;
  amount_total: number;
  state?: string;
  order_lines?: any; // JSON data for order lines
  created_at: Date;
  updated_at: Date;
}

export interface CombinedTargetData {
  // Internal target data
  internal?: {
    id: string;
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    year: number;
    productCategory: string;
    targetAmount: number;
    achievedAmount: number;
    agencyId?: string;
    agencyName?: string;
    source: 'internal';
  };
  
  // External target data
  external?: {
    id: string;
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    year: number;
    productCategory: string;
    targetAmount: number;
    achievedAmount: number;
    agencyName: string;
    source: 'external';
  };
  
  // Combined metrics
  combined: {
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    year: number;
    productCategory: string;
    totalTarget: number;
    totalAchieved: number;
    achievementPercentage: number;
    agencyName: string;
    hasBothSources: boolean;
  };
}

export interface TargetAchievementCalculation {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  productCategory: string;
  agencyName: string;
  
  // Achievement from internal invoices
  internalAchievement: number;
  
  // Achievement from external invoices
  externalAchievement: number;
  
  // Combined achievement
  totalAchievement: number;
}

export interface AgencyNameMapping {
  agencyId: string;
  agencyName: string;
  isActive: boolean;
  lastSynced?: Date;
}

// Utility type for data source indicators
export type DataSource = 'internal' | 'external' | 'combined';

// Filter options for external data
export interface ExternalTargetFilters {
  agencyName?: string;
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'all';
  year?: number | 'all';
  productCategory?: string | 'all';
  dataSource?: DataSource | 'all';
}