import { useEffect, useMemo, useState } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Droplet, Receipt, Fuel, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/utils/storage';
import ImageModal from '@/components/ui/image-modal';
import { useAgencies } from '@/hooks/useAgency';
import { useAgencyFeatureAccess } from '@/hooks/useAgencyFeatureAccess';

interface FuelExpensesProps {
  user: User;
}

interface FuelRechargeRow {
  id: string;
  agency_id: string;
  user_id: string;
  odometer_km: number;
  bill_photo_url: string;
  bill_photo_path: string;
  occurred_at: string;
  notes?: string | null;
}

interface AgencyExpenseRow {
  id: string;
  agency_id: string;
  user_id: string;
  category: string;
  amount: number;
  bill_photo_url: string;
  bill_photo_path: string;
  occurred_at: string;
  notes?: string | null;
}

const STORAGE_BUCKET = 'agency-expense-photos';

const FuelExpenses = ({ user }: FuelExpensesProps) => {
  const { toast } = useToast();
  const { agencies } = useAgencies();
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    user.role === 'superuser' ? null : user.agencyId || null
  );
  const { features } = useAgencyFeatureAccess(user.role === 'superuser' ? selectedAgencyId : user.agencyId);

  const [fuelOdometer, setFuelOdometer] = useState('');
  const [fuelDate, setFuelDate] = useState('');
  const [fuelNotes, setFuelNotes] = useState('');
  const [fuelBillFile, setFuelBillFile] = useState<File | null>(null);

  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseBillFile, setExpenseBillFile] = useState<File | null>(null);

  const [fuelLogs, setFuelLogs] = useState<FuelRechargeRow[]>([]);
  const [expenseLogs, setExpenseLogs] = useState<AgencyExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [imageModalTitle, setImageModalTitle] = useState<string>('');

  const canAccessModule = user.role === 'superuser' || features.enableFuelExpenses;
  const activeAgencyId = useMemo(() => {
    if (user.role === 'superuser') return selectedAgencyId;
    return user.agencyId || null;
  }, [selectedAgencyId, user]);
  const disableActions = user.role === 'superuser' && !activeAgencyId;

  useEffect(() => {
    if (!canAccessModule || !activeAgencyId) {
      setFuelLogs([]);
      setExpenseLogs([]);
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      try {
        setLoading(true);

        const { data: fuelData, error: fuelError } = await supabase
          .from('fuel_recharges')
          .select('*')
          .eq('agency_id', activeAgencyId)
          .order('occurred_at', { ascending: false });

        if (fuelError) throw fuelError;

        const { data: expenseData, error: expenseError } = await supabase
          .from('agency_expenses')
          .select('*')
          .eq('agency_id', activeAgencyId)
          .order('occurred_at', { ascending: false });

        if (expenseError) throw expenseError;

        setFuelLogs(fuelData || []);
        setExpenseLogs(expenseData || []);
      } catch (error) {
        console.error('Error fetching fuel/expense logs:', error);
        toast({
          title: 'Error',
          description: 'Failed to load fuel and expense logs.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [activeAgencyId, canAccessModule, toast]);

  const uploadReceipt = async (file: File, path: string) => {
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `receipt-${Date.now()}.${extension}`;
    const upload = await uploadFile({
      bucket: STORAGE_BUCKET,
      path,
      file,
      fileName,
    });

    if (!upload.success || !upload.url) {
      throw new Error(upload.error || 'Failed to upload receipt');
    }

    return {
      url: upload.url,
      path: `${path}/${fileName}`,
    };
  };

  const handleFuelSubmit = async () => {
    if (!activeAgencyId) {
      toast({
        title: 'Select an agency',
        description: 'Please select an agency before logging fuel.',
        variant: 'destructive',
      });
      return;
    }

    const odometerValue = Number(fuelOdometer);
    if (!odometerValue || odometerValue <= 0) {
      toast({
        title: 'Odometer required',
        description: 'Please enter a valid odometer reading.',
        variant: 'destructive',
      });
      return;
    }

    if (!fuelBillFile) {
      toast({
        title: 'Receipt required',
        description: 'Please upload the fuel bill photo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const path = `agency-${activeAgencyId}/fuel`;
      const receipt = await uploadReceipt(fuelBillFile, path);

      const { data, error } = await supabase
        .from('fuel_recharges')
        .insert([
          {
            agency_id: activeAgencyId,
            user_id: user.id,
            odometer_km: odometerValue,
            bill_photo_url: receipt.url,
            bill_photo_path: receipt.path,
            occurred_at: fuelDate ? new Date(fuelDate).toISOString() : new Date().toISOString(),
            notes: fuelNotes || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setFuelLogs((prev) => [data, ...prev]);
      setFuelOdometer('');
      setFuelDate('');
      setFuelNotes('');
      setFuelBillFile(null);

      toast({
        title: 'Fuel logged',
        description: 'Fuel recharge saved successfully.',
      });
    } catch (error) {
      console.error('Error logging fuel recharge:', error);
      toast({
        title: 'Error',
        description: 'Failed to log fuel recharge.',
        variant: 'destructive',
      });
    }
  };

  const handleExpenseSubmit = async () => {
    if (!activeAgencyId) {
      toast({
        title: 'Select an agency',
        description: 'Please select an agency before logging expenses.',
        variant: 'destructive',
      });
      return;
    }

    const amountValue = Number(expenseAmount);
    if (!expenseCategory.trim()) {
      toast({
        title: 'Category required',
        description: 'Please enter an expense category.',
        variant: 'destructive',
      });
      return;
    }

    if (!amountValue || amountValue <= 0) {
      toast({
        title: 'Amount required',
        description: 'Please enter a valid amount.',
        variant: 'destructive',
      });
      return;
    }

    if (!expenseBillFile) {
      toast({
        title: 'Receipt required',
        description: 'Please upload the expense bill photo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const path = `agency-${activeAgencyId}/expenses`;
      const receipt = await uploadReceipt(expenseBillFile, path);

      const { data, error } = await supabase
        .from('agency_expenses')
        .insert([
          {
            agency_id: activeAgencyId,
            user_id: user.id,
            category: expenseCategory.trim(),
            amount: amountValue,
            bill_photo_url: receipt.url,
            bill_photo_path: receipt.path,
            occurred_at: expenseDate ? new Date(expenseDate).toISOString() : new Date().toISOString(),
            notes: expenseNotes || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setExpenseLogs((prev) => [data, ...prev]);
      setExpenseCategory('');
      setExpenseAmount('');
      setExpenseDate('');
      setExpenseNotes('');
      setExpenseBillFile(null);

      toast({
        title: 'Expense logged',
        description: 'Expense saved successfully.',
      });
    } catch (error) {
      console.error('Error logging expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to log expense.',
        variant: 'destructive',
      });
    }
  };

  if (!canAccessModule) {
    return (
      <div className="p-6">
        <Card className="bg-white/90 border border-white/20 shadow-lg rounded-2xl">
          <CardContent className="p-8 text-center text-slate-600">
            Fuel and expense tracking is not enabled for your agency.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {user.role === 'superuser' && (
        <Card className="bg-white/90 border border-white/20 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-800">Select Agency</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAgencyId || ''} onValueChange={(value) => setSelectedAgencyId(value)}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select an agency" />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {disableActions && (
              <p className="mt-3 text-sm text-slate-500">Select an agency to log or view fuel and expenses.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/90 border border-white/20 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Fuel className="h-5 w-5 text-emerald-600" />
              Fuel Recharge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Odometer (km)</Label>
              <Input
                type="number"
                min="0"
                value={fuelOdometer}
                onChange={(e) => setFuelOdometer(e.target.value)}
              />
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={fuelDate}
                onChange={(e) => setFuelDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Fuel Bill Photo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setFuelBillFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={fuelNotes} onChange={(e) => setFuelNotes(e.target.value)} />
            </div>
            <Button onClick={handleFuelSubmit} className="w-full" disabled={disableActions}>
              Log Fuel
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/90 border border-white/20 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Receipt className="h-5 w-5 text-blue-600" />
              Other Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Category</Label>
              <Input value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Expense Bill Photo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setExpenseBillFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} />
            </div>
            <Button onClick={handleExpenseSubmit} className="w-full" disabled={disableActions}>
              Log Expense
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/90 border border-white/20 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Droplet className="h-5 w-5 text-emerald-600" />
              Fuel Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : fuelLogs.length === 0 ? (
              <p className="text-slate-500">No fuel logs found.</p>
            ) : (
              <div className="space-y-3">
                {fuelLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-xl">
                    <div>
                      <p className="font-medium text-slate-800">{log.odometer_km} km</p>
                      <p className="text-xs text-slate-500">
                        {new Date(log.occurred_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageModalUrl(log.bill_photo_url);
                        setImageModalTitle('Fuel Bill');
                      }}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/90 border border-white/20 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Receipt className="h-5 w-5 text-blue-600" />
              Expense Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : expenseLogs.length === 0 ? (
              <p className="text-slate-500">No expense logs found.</p>
            ) : (
              <div className="space-y-3">
                {expenseLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-xl">
                    <div>
                      <p className="font-medium text-slate-800">{log.category}</p>
                      <p className="text-xs text-slate-500">
                        LKR {Number(log.amount).toLocaleString()} · {new Date(log.occurred_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageModalUrl(log.bill_photo_url);
                        setImageModalTitle('Expense Bill');
                      }}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ImageModal
        isOpen={Boolean(imageModalUrl)}
        onClose={() => setImageModalUrl(null)}
        imageUrl={imageModalUrl || ''}
        title={imageModalTitle}
      />
    </div>
  );
};

export default FuelExpenses;
