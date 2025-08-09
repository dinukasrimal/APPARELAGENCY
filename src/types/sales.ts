export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  agencyId: string;
  items: SalesOrderItem[];
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  total: number;
  totalInvoiced: number;
  status: 'pending' | 'approved' | 'partially_invoiced' | 'invoiced' | 'cancelled' | 'closed';
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  dispute?: Dispute;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  createdBy: string;
}

export interface SalesOrderItem {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  agencyId: string;
  agencyName: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  signature?: string;
  createdAt: Date;
  createdBy: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Dispute {
  id: string;
  type: 'product_category' | 'specific_product' | 'customer';
  targetId: string; // productId, categoryId, or customerId
  targetName: string;
  reason: string;
  description: string;
  assignedTo: string; // User ID
  assignedBy: string; // User ID
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
}

export interface Return {
  id: string;
  invoiceId: string;
  customerId: string;
  customerName: string;
  agencyId: string;
  items: ReturnItem[];
  subtotal: number;
  total: number;
  reason: string;
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  createdBy: string;
  processedAt?: Date;
  processedBy?: string;
}

export interface ReturnItem {
  id: string;
  invoiceItemId: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantityReturned: number;
  originalQuantity: number;
  unitPrice: number;
  total: number;
  reason: string;
}

export interface Delivery {
  id: string;
  invoiceId: string;
  deliveryAgentId: string;
  agencyId: string;
  status: 'pending' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled';
  scheduledDate?: Date;
  deliveredAt?: Date;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliverySignature?: string;
  deliveryNotes?: string;
  receivedByName?: string;
  receivedByPhone?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  
  // Related data
  invoice?: Invoice;
  items?: DeliveryItem[];
  deliveryAgentName?: string;
}

export interface DeliveryItem {
  id: string;
  deliveryId: string;
  invoiceItemId: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  itemCondition: 'good' | 'damaged' | 'missing';
  conditionNotes?: string;
  createdAt: Date;
}
