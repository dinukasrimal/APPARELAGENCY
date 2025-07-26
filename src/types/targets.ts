
export interface QuarterlyTarget {
  id: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  productCategory: string;
  targetAmount: number;
  achievedAmount: number;
  agencyId?: string; // If null, it's a global target
  agencyName?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TargetSummary {
  quarter: string;
  year: number;
  totalTarget: number;
  totalAchieved: number;
  achievementPercentage: number;
  categories: {
    category: string;
    target: number;
    achieved: number;
    percentage: number;
  }[];
}
