import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/auth';
import { Invoice, Return } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Wallet } from 'lucide-react';

interface Allocation {
  id: string;
  invoice_id: string;
  amount: number;
}

interface ReturnCreditPanelProps {
  user: User;
  returnItem: Return;
  invoices: Invoice[];
  onChanged?: () => void;
}

const money = (value: number) => `LKR ${Math.round(value).toLocaleString()}`;

/**
 * Spending a return's value.
 *
 * The return is worth something the moment the goods come back. That value sits
 * as credit until someone decides where it goes: all of it against one invoice,
 * split across several, or left alone until the customer's next invoice exists.
 */
const ReturnCreditPanel = ({ user, returnItem, invoices, onChanged }: ReturnCreditPanelProps) => {
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('return_credit_allocations')
      .select('id, invoice_id, amount')
      .eq('return_id', returnItem.id);

    if (error) {
      console.error('Could not load the credit applied from this return:', error);
    }
    setAllocations((data || []).map(row => ({ ...row, amount: Number(row.amount) })));
    setLoading(false);
  }, [returnItem.id]);

  useEffect(() => { void load(); }, [load]);

  const applied = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const remaining = Math.max(0, returnItem.total - applied);

  // A return whose discount went over the agency's limit is still waiting on
  // head office; its goods are back in stock but its value isn't spendable yet.
  const awaitingApproval = returnItem.status === 'pending';
  const rejected = returnItem.status === 'rejected';

  const customerInvoices = useMemo(() => {
    const allocatedIds = new Set(allocations.map(a => a.invoice_id));
    return invoices
      .filter(invoice =>
        invoice.customerId === returnItem.customerId &&
        (allocatedIds.has(invoice.id) || (invoice.outstandingAmount ?? invoice.total) > 0))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [invoices, returnItem.customerId, allocations]);

  const allocationFor = (invoiceId: string) =>
    allocations.find(allocation => allocation.invoice_id === invoiceId);

  const apply = async (invoice: Invoice) => {
    const typed = Number(amounts[invoice.id] || 0);
    const outstanding = invoice.outstandingAmount ?? invoice.total;
    const amount = Math.min(typed, remaining, outstanding);

    if (!(amount > 0)) {
      toast({
        title: 'Nothing to apply',
        description: typed > 0
          ? 'That is more than the credit left, or more than this invoice still owes.'
          : 'Enter how much of the credit to put against this invoice.',
        variant: 'destructive',
      });
      return;
    }

    setBusyInvoiceId(invoice.id);
    try {
      const existing = allocationFor(invoice.id);
      const { error } = existing
        ? await supabase
            .from('return_credit_allocations')
            .update({ amount: existing.amount + amount })
            .eq('id', existing.id)
        : await supabase
            .from('return_credit_allocations')
            .insert({
              return_id: returnItem.id,
              invoice_id: invoice.id,
              amount,
              created_by: user.id,
            });

      if (error) throw error;

      setAmounts(previous => ({ ...previous, [invoice.id]: '' }));
      await load();
      onChanged?.();
      toast({
        title: 'Credit applied',
        description: `${money(amount)} of this return now sits against invoice ${invoice.invoiceNumber}.`,
      });
    } catch (error) {
      toast({
        title: 'Could not apply the credit',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const remove = async (allocation: Allocation) => {
    setBusyInvoiceId(allocation.invoice_id);
    try {
      const { error } = await supabase
        .from('return_credit_allocations')
        .delete()
        .eq('id', allocation.id);
      if (error) throw error;

      await load();
      onChanged?.();
      toast({ title: 'Credit taken back', description: 'That invoice owes the amount again.' });
    } catch (error) {
      toast({
        title: 'Could not take the credit back',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyInvoiceId(null);
    }
  };

  if (rejected) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Credit from this return
          </span>
          <span className="flex items-center gap-2 text-sm font-normal">
            <span className="text-muted-foreground">{money(applied)} applied</span>
            <Badge variant={remaining > 0 ? 'default' : 'secondary'}>{money(remaining)} left</Badge>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {awaitingApproval && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The discount on this return is above the agency limit, so head office has to approve it before the
            credit can be applied. The goods are already back in stock.
          </p>
        )}

        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : customerInvoices.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {remaining > 0
              ? `${money(remaining)} is sitting as credit for ${returnItem.customerName}. It can be applied as soon as they have an invoice outstanding.`
              : 'This return has been used up.'}
          </p>
        ) : (
          <div className="space-y-2">
            {customerInvoices.map(invoice => {
              const allocation = allocationFor(invoice.id);
              const outstanding = invoice.outstandingAmount ?? invoice.total;
              const busy = busyInvoiceId === invoice.id;

              return (
                <div key={invoice.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                  <div className="min-w-[8rem] flex-1">
                    <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.createdAt.toLocaleDateString()} · {money(invoice.total)} · {money(outstanding)} outstanding
                    </p>
                  </div>

                  {allocation && (
                    <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs text-green-800">
                      {money(allocation.amount)} applied
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1"
                        disabled={busy}
                        onClick={() => void remove(allocation)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </span>
                  )}

                  {remaining > 0 && outstanding > 0 && !awaitingApproval && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-28 text-right"
                        placeholder={String(Math.round(Math.min(remaining, outstanding)))}
                        value={amounts[invoice.id] ?? ''}
                        onChange={(event) =>
                          setAmounts(previous => ({ ...previous, [invoice.id]: event.target.value }))
                        }
                      />
                      <Button size="sm" disabled={busy} onClick={() => void apply(invoice)}>
                        Apply
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {remaining > 0 && customerInvoices.length > 0 && !awaitingApproval && (
          <p className="text-xs text-muted-foreground">
            Leave it alone to keep {money(remaining)} as credit for {returnItem.customerName}'s future invoices.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ReturnCreditPanel;
