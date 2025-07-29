
export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  transactionType: 'grn_acceptance' | 'invoice_creation' | 'customer_return' | 'company_return' | 'adjustment' | 'external_invoice';
  quantity: number; // positive for additions, negative for deductions
  referenceId: string; // ID of the related GRN, Invoice, or Return
  referenceName: string; // For display purposes
  userId: string;
  agencyId: string;
  createdAt: Date;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  subCategory: string;
  color: string;
  size: string;
  currentStock: number;
  agencyId: string;
  lastUpdated: Date;
  minimumStock?: number;
  maximumStock?: number;
}

export interface InventoryAdjustment {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  adjustmentType: 'increase' | 'decrease';
  quantity: number;
  reason: string;
  userId: string;
  agencyId: string;
  createdAt: Date;
}

export interface StockAdjustmentRequest {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  adjustmentType: 'increase' | 'decrease';
  quantity: number;
  currentStock: number;
  newStock: number;
  reason: string;
  justification: string;
  requestedBy: string;
  agencyId: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}
