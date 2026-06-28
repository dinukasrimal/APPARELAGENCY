import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Bell, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  user: User;
  onBack: () => void;
}

const PONotificationSettings = ({ onBack }: Props) => {
  const [phones, setPhones] = useState<string[]>(['']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'po_notification_phones')
        .single();
      if (data?.value) {
        const saved = data.value.split(',').map((p: string) => p.trim()).filter(Boolean);
        setPhones(saved.length > 0 ? saved : ['']);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const cleaned = phones.map(p => p.trim()).filter(Boolean);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'po_notification_phones', value: cleaned.join(','), updated_at: new Date().toISOString() });

    if (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'PO notification numbers updated successfully' });
    }
    setSaving(false);
  };

  const updatePhone = (index: number, value: string) => {
    setPhones(prev => prev.map((p, i) => (i === index ? value : p)));
  };

  const addPhone = () => setPhones(prev => [...prev, '']);
  const removePhone = (index: number) => setPhones(prev => prev.filter((_, i) => i !== index));

  return (
    <div className="p-4 max-w-xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="mb-4 flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Purchase Order Notification Numbers
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            When any agency submits a purchase order, an SMS with a PDF link will be sent to all numbers listed here.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              {phones.map((phone, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">Phone number {i + 1}</Label>
                    <Input
                      placeholder="e.g. 0771234567"
                      value={phone}
                      onChange={e => updatePhone(i, e.target.value)}
                    />
                  </div>
                  {phones.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-5 text-destructive hover:text-destructive"
                      onClick={() => removePhone(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={addPhone} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add another number
              </Button>

              <Button onClick={handleSave} disabled={saving} className="w-full flex items-center gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Numbers'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PONotificationSettings;
