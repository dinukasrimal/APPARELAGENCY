export interface Collection {
  id: string;
  customerId: string;
  customerName: string;
  agencyId: string;
  totalAmount: number;
  paymentMethod: string;
  cashAmount: number;
  chequeAmount: number;
  cashDate: Date;
  chequeDetails: ChequeDetail[];
  notes?: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  createdBy: string;
  status: string;
}

export interface ChequeDetail {
  id: string;
  chequeNumber: string;
  bankName: string;
  amount: number;
  chequeDate: Date;
  status: string;
  clearedAt?: Date;
  returnedAt?: Date;
  returnReason?: string;
}

export interface CollectionAllocation {
  id: string;
  collectionId: string;
  invoiceId: string;
  allocatedAmount: number;
  allocatedAt: Date;
  allocatedBy: string;
}

export interface CustomerInvoiceSummary {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalCollected: number;
  unrealizedPayments: number;
  outstandingAmount: number;
  outstandingWithUnrealized: number;
  outstandingWithCheques: number;
  outstandingWithoutCheques: number;
  returnedChequesAmount: number;
  returnedChequesCount: number;
  invoices: InvoiceSummary[];
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber?: string;
  total: number;
  collectedAmount: number;
  outstandingAmount: number;
  createdAt: Date;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
}

export interface CollectionFormData {
  customerId: string;
  customerName: string;
  totalAmount: number;
  paymentMethod: string;
  cashAmount: number;
  chequeAmount: number;
  cashDate: Date;
  chequeDetails: Omit<ChequeDetail, 'id' | 'status' | 'clearedAt'>[];
  selectedInvoiceIds: string[];
  notes?: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
} 