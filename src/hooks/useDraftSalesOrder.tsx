import { useState, useEffect, useCallback } from 'react';
import { SalesOrderItem } from '@/types/sales';
import { Customer } from '@/types/customer';

interface DraftSalesOrder {
  customerId: string | null;
  customerName: string;
  items: SalesOrderItem[];
  discountPercentage: number;
  isDraft: boolean;
  lastModified: Date;
}

export const useDraftSalesOrder = () => {
  const [draft, setDraft] = useState<DraftSalesOrder>({
    customerId: null,
    customerName: '',
    items: [],
    discountPercentage: 20,
    isDraft: true,
    lastModified: new Date()
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('salesOrderDraft');
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setDraft({
          ...parsedDraft,
          lastModified: new Date(parsedDraft.lastModified)
        });
        setHasUnsavedChanges(true);
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, []);

  // Save draft to localStorage whenever it changes
  const saveDraft = useCallback((newDraft: Partial<DraftSalesOrder>) => {
    const updatedDraft = {
      ...draft,
      ...newDraft,
      isDraft: true,
      lastModified: new Date()
    };
    
    setDraft(updatedDraft);
    localStorage.setItem('salesOrderDraft', JSON.stringify(updatedDraft));
    setHasUnsavedChanges(true);
  }, [draft]);

  const updateCustomer = useCallback((customer: Customer | null) => {
    if (customer) {
      saveDraft({
        customerId: customer.id,
        customerName: customer.name
      });
    } else {
      saveDraft({
        customerId: null,
        customerName: ''
      });
    }
  }, [saveDraft]);

  const updateItems = useCallback((items: SalesOrderItem[]) => {
    saveDraft({ items });
  }, [saveDraft]);

  const updateDiscount = useCallback((discountPercentage: number) => {
    saveDraft({ discountPercentage });
  }, [saveDraft]);

  const resetOrder = useCallback(() => {
    const emptyDraft: DraftSalesOrder = {
      customerId: null,
      customerName: '',
      items: [],
      discountPercentage: 20,
      isDraft: true,
      lastModified: new Date()
    };
    
    setDraft(emptyDraft);
    localStorage.removeItem('salesOrderDraft');
    setHasUnsavedChanges(false);
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem('salesOrderDraft');
    setHasUnsavedChanges(false);
  }, []);

  const changeCustomer = useCallback(() => {
    // Reset everything except keep it as draft
    saveDraft({
      customerId: null,
      customerName: '',
      items: [],
      discountPercentage: 20
    });
  }, [saveDraft]);

  return {
    draft,
    hasUnsavedChanges,
    updateCustomer,
    updateItems,
    updateDiscount,
    resetOrder,
    clearDraft,
    changeCustomer
  };
};
