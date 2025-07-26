
export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  transactionType: 'grn_acceptance' | 'invoice_creation' | 'customer_return' | 'company_return';
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
