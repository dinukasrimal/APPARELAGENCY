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
  const createEmptyDraft = (): DraftSalesOrder => ({
    customerId: null,
    customerName: '',
    items: [],
    discountPercentage: 0,
    isDraft: true,
    lastModified: new Date()
  });

  const [draft, setDraft] = useState<DraftSalesOrder>({
    ...createEmptyDraft()
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('salesOrderDraft');
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);

        // Ignore and clear very old drafts (older than 24 hours)
        const now = new Date();
        const parsedLastModified = parsedDraft.lastModified
          ? new Date(parsedDraft.lastModified)
          : null;

        if (parsedLastModified && now.getTime() - parsedLastModified.getTime() > 24 * 60 * 60 * 1000) {
          localStorage.removeItem('salesOrderDraft');
          setDraft(createEmptyDraft());
          setHasUnsavedChanges(false);
          return;
        }
        const hydratedDraft: DraftSalesOrder = {
          ...createEmptyDraft(),
          ...parsedDraft,
          lastModified: parsedDraft.lastModified
            ? new Date(parsedDraft.lastModified)
            : new Date()
        };

        setDraft(hydratedDraft);

        const hasMeaningfulChanges =
          !!hydratedDraft.customerId ||
          (Array.isArray(hydratedDraft.items) && hydratedDraft.items.length > 0) ||
          hydratedDraft.discountPercentage > 0;

        setHasUnsavedChanges(hasMeaningfulChanges);
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, []);

  // Save draft to localStorage whenever it changes
  const saveDraft = useCallback((newDraft: Partial<DraftSalesOrder>) => {
    setDraft(prevDraft => {
      const updatedDraft = {
        ...prevDraft,
        ...newDraft,
        isDraft: true,
        lastModified: new Date()
      };
      
      localStorage.setItem('salesOrderDraft', JSON.stringify(updatedDraft));
      setHasUnsavedChanges(true);
      return updatedDraft;
    });
  }, []);

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
    const emptyDraft = createEmptyDraft();
    setDraft(emptyDraft);
    localStorage.removeItem('salesOrderDraft');
    setHasUnsavedChanges(false);
  }, []);

  const clearDraft = useCallback(() => {
    const emptyDraft = createEmptyDraft();
    setDraft(emptyDraft);
    localStorage.removeItem('salesOrderDraft');
    setHasUnsavedChanges(false);
  }, []);

  const changeCustomer = useCallback(() => {
    // Reset everything except keep it as draft
    saveDraft({
      customerId: null,
      customerName: '',
      items: [],
      discountPercentage: 0
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
