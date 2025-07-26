
export interface PurchaseOrder {
  id: string;
  agencyId: string;
  agencyName: string;
  items: PurchaseOrderItem[];
  total: number;
  status: 'pending' | 'approved' | 'shipped' | 'delivered' | 'cancelled';
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
