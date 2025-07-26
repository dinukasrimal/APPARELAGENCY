
export interface NonProductiveVisit {
  id: string;
  agencyId: string;
  userId: string;
  reason: string;
  notes?: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  createdBy: string;
}

export interface TimeTracking {
  id: string;
  agencyId: string;
  userId: string;
  clockInTime: Date;
  clockOutTime?: Date;
  clockInLatitude?: number;
  clockInLongitude?: number;
  clockOutLatitude?: number;
  clockOutLongitude?: number;
  totalHours?: string;
  date: string;
  createdAt: Date;
}

export const NON_PRODUCTIVE_REASONS = [
  'Customer not available',
  'Store closed',
  'No decision maker present',
  'Customer busy',
  'Inventory issues',
  'Payment issues',
  'Market research',
  'Competitor analysis',
  'Route planning',
  'Other'
] as const;

export type NonProductiveReason = typeof NON_PRODUCTIVE_REASONS[number];
