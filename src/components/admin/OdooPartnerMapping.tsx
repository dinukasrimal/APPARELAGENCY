import { useState, useEffect, useMemo } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link2, Search, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllSupabaseRows } from '@/utils/supabasePagination';
import { ExternalDataService } from '@/services/external-data.service';
import { useToast } from '@/hooks/use-toast';

interface OdooPartnerMappingProps {
  user: User;
}

interface Agency { id: string; name: string; }
interface Mapping { id: string; partner_name: string; agency_id: string; agency_name: string | null; }

// The new table isn't in the generated Supabase types yet.
const db = supabase as any;

const norm = (s?: string | null) => (s || '').toLowerCase().trim();

const OdooPartnerMapping = ({ user }: OdooPartnerMappingProps) => {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [manualPartner, setManualPartner] = useState('');
  const [manualAgency, setManualAgency] = useState('');

  const isSuperuser = user.role === 'superuser';

  useEffect(() => { if (isSuperuser) loadAll(); }, [isSuperuser]);

  const loadAll = async () => {
    setLoading(true);

    // Agencies
    try {
      const { data } = await supabase.from('agencies').select('id, name').order('name');
      setAgencies(data || []);
    } catch (e: any) {
      toast({ title: 'Error loading agencies', description: e.message, variant: 'destructive' });
    }

    // Partner names — merge two sources so the list is complete even if one is
    // blocked by RLS: the external invoice feed (all partners, incl. unmapped)
    // and reference_name from already-synced rows (definitely readable).
    const partnerSet = new Set<string>();
    // Source 1: app-side bot invoice feed (may be RLS-restricted)
    try {
      const partnerRows = await fetchAllSupabaseRows<{ partner_name: string | null }>(
        () => db.from('external_bot_project_invoices').select('partner_name')
      );
      (partnerRows || []).forEach((r) => { const v = (r.partner_name || '').trim(); if (v) partnerSet.add(v); });
    } catch (e: any) {
      console.warn('external_bot_project_invoices read failed:', e?.message);
    }
    // Source 2: the external (Odoo) invoices themselves — partner_name field.
    // (reference_name in external_inventory_management holds invoice numbers, not
    // partner names, so it is intentionally not used here.)
    try {
      const svc = ExternalDataService.getInstance();
      if (svc.isAvailable && svc.isAvailable()) {
        const { data: extInvoices } = await svc.getInvoices({});
        (extInvoices || []).forEach((inv: any) => {
          const v = (inv.partner_name || '').trim();
          if (v) partnerSet.add(v);
        });
      }
    } catch (e: any) {
      console.warn('external Odoo invoices read failed:', e?.message);
    }
    const uniquePartners = Array.from(partnerSet).sort((a, b) => a.localeCompare(b));
    setPartners(uniquePartners);
    if (uniquePartners.length === 0) {
      toast({
        title: 'No partners found',
        description: 'Neither the invoice feed nor synced inventory returned partner names. Check RLS / that a sync has run.',
      });
    }

    // Existing mappings (table may not exist yet if migration not run)
    try {
      const mappingRows = await fetchAllSupabaseRows<Mapping>(
        () => db.from('odoo_partner_mappings').select('id, partner_name, agency_id, agency_name')
      );
      setMappings(mappingRows || []);
    } catch (e: any) {
      toast({
        title: 'Mapping table missing',
        description: 'Run the odoo_partner_mappings migration in Supabase, then refresh.',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const mappingByPartner = useMemo(() => {
    const m = new Map<string, Mapping>();
    mappings.forEach((row) => m.set(norm(row.partner_name), row));
    return m;
  }, [mappings]);

  const addManual = async () => {
    const name = manualPartner.trim();
    if (!name || !manualAgency) {
      toast({ title: 'Enter a partner name and pick an agency', variant: 'destructive' });
      return;
    }
    if (!partners.includes(name)) setPartners((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    await assignAgency(name, manualAgency);
    setManualPartner('');
    setManualAgency('');
  };

  const assignAgency = async (partnerName: string, agencyId: string) => {
    setSaving(partnerName);
    try {
      const agency = agencies.find((a) => a.id === agencyId);
      const existing = mappingByPartner.get(norm(partnerName));

      if (!agencyId) {
        // "Unassigned" chosen — remove any existing mapping
        if (existing) {
          const { error } = await db.from('odoo_partner_mappings').delete().eq('id', existing.id);
          if (error) throw error;
          setMappings((prev) => prev.filter((m) => m.id !== existing.id));
        }
        return;
      }

      if (existing) {
        const { error } = await db
          .from('odoo_partner_mappings')
          .update({ agency_id: agencyId, agency_name: agency?.name || null })
          .eq('id', existing.id);
        if (error) throw error;
        setMappings((prev) => prev.map((m) =>
          m.id === existing.id ? { ...m, agency_id: agencyId, agency_name: agency?.name || null } : m
        ));
      } else {
        const { data, error } = await db
          .from('odoo_partner_mappings')
          .insert({ partner_name: partnerName, agency_id: agencyId, agency_name: agency?.name || null, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        setMappings((prev) => [...prev, data as Mapping]);
      }
      toast({ title: 'Saved', description: `${partnerName} → ${agency?.name}` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save mapping', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const visiblePartners = useMemo(() => {
    return partners.filter((p) => {
      if (search && !p.toLowerCase().includes(search.toLowerCase())) return false;
      const mapped = mappingByPartner.has(norm(p));
      if (filter === 'mapped') return mapped;
      if (filter === 'unmapped') return !mapped;
      return true;
    });
  }, [partners, search, filter, mappingByPartner]);

  const mappedCount = partners.filter((p) => mappingByPartner.has(norm(p))).length;
  const unmappedCount = partners.length - mappedCount;

  if (!isSuperuser) {
    return (
      <Card><CardContent className="py-10 text-center text-gray-500">
        This module is available to superusers only.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="h-6 w-6" /> Odoo Partner → Agency Mapping
          </h2>
          <p className="text-gray-600">Assign each Odoo partner to an agency so external invoice sync never mixes up or skips agencies.</p>
        </div>
        <Button variant="outline" onClick={loadAll} disabled={loading} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500">Total Partners</div>
          <div className="text-2xl font-bold">{partners.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Mapped</div>
          <div className="text-2xl font-bold text-green-700">{mappedCount}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-orange-600" /> Unmapped</div>
          <div className="text-2xl font-bold text-orange-700">{unmappedCount}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Partners</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(['all', 'unmapped', 'mapped'] as const).map((f) => (
                  <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
                    {f[0].toUpperCase() + f.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input placeholder="Search partner..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Manual add — map an exact partner string (e.g. from the sync's
              unmatchedPartnerNames output) even if it isn't in the list. */}
          <div className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-gray-50 rounded-md">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-500 mb-1 block">Partner name (exact)</label>
              <Input placeholder="e.g. JAFFNA - INTHARA" value={manualPartner} onChange={(e) => setManualPartner(e.target.value)} />
            </div>
            <div className="w-56">
              <label className="text-xs text-gray-500 mb-1 block">Agency</label>
              <Select value={manualAgency} onValueChange={setManualAgency}>
                <SelectTrigger><SelectValue placeholder="Select agency" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addManual} disabled={!manualPartner.trim() || !manualAgency}>Add mapping</Button>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading partners...</div>
          ) : visiblePartners.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">No partners match this filter.</div>
          ) : (
            <div className="divide-y">
              {visiblePartners.map((partner) => {
                const mapping = mappingByPartner.get(norm(partner));
                return (
                  <div key={partner} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{partner}</div>
                      {mapping ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs mt-1">
                          {mapping.agency_name || 'Mapped'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs mt-1">Unmapped</Badge>
                      )}
                    </div>
                    <div className="shrink-0 w-64">
                      <Select
                        value={mapping?.agency_id || ''}
                        onValueChange={(v) => assignAgency(partner, v === '__none__' ? '' : v)}
                        disabled={saving === partner}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Assign agency..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Unassigned —</SelectItem>
                          {agencies.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OdooPartnerMapping;
