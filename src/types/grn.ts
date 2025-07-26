
export interface CompanyInvoice {
  id: string;
  fileName: string;
  agencyId: string;
  agencyName: string;
  total: number;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface GRNItem {
  id: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  total: number;
}

export interface GRN {
  id: string;
  invoiceId: string;
  invoiceFileName: string;
  agencyId: string;
  agencyName: string;
  items: GRNItem[];
  total: number;
  status: 'pending' | 'accepted' | 'rejected';
  uploadedBy: string;
  assignedAt: Date;
  createdAt: Date;
  processedAt?: Date;
  processedBy?: string;
  rejectionReason?: string;
}
