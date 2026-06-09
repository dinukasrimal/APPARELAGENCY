const COMPACT_INVOICE_NUMBER_PATTERN = /^[A-Z0-9]{3}\d{3,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AgencyPrefixRow {
  id: string;
  name: string | null;
}

interface InvoiceNumberSupabaseClient {
  from(table: 'agencies'): {
    select: (columns: string) => {
      order: (column: string) => Promise<{
        data: AgencyPrefixRow[] | null;
        error: Error | null;
      }>;
    };
  };
  from(table: 'invoices'): {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        like: (column: string, pattern: string) => Promise<{
          data: Array<{ invoice_number: string | null }> | null;
          error: Error | null;
        }>;
      };
    };
  };
}

const getBaseAgencyInvoicePrefix = (agencyName?: string | null, agencyId?: string | null) => {
  const source = agencyName || agencyId || 'INV';
  const prefix = source.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return prefix.padEnd(3, 'X');
};

const getCollisionMarker = (index: number) => (index + 1).toString(36).toUpperCase().slice(-1);

export const getAgencyInvoicePrefix = (agencyName?: string | null, agencyId?: string | null) =>
  getBaseAgencyInvoicePrefix(agencyName, agencyId);

export const getUniqueAgencyInvoicePrefix = (
  agencyId: string,
  agencies: AgencyPrefixRow[],
  fallbackAgencyName?: string | null
) => {
  const agencyRows = agencies.length > 0
    ? agencies
    : [{ id: agencyId, name: fallbackAgencyName || agencyId }];
  const currentAgency = agencyRows.find((agency) => agency.id === agencyId) || {
    id: agencyId,
    name: fallbackAgencyName || agencyId,
  };
  const basePrefix = getBaseAgencyInvoicePrefix(currentAgency.name, currentAgency.id);
  const prefixPeers = agencyRows
    .filter((agency) => getBaseAgencyInvoicePrefix(agency.name, agency.id) === basePrefix)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '') || a.id.localeCompare(b.id));

  if (prefixPeers.length <= 1) return basePrefix;

  const peerIndex = Math.max(0, prefixPeers.findIndex((agency) => agency.id === agencyId));
  return `${basePrefix.slice(0, 2)}${getCollisionMarker(peerIndex)}`;
};

export const isCompactInvoiceNumber = (invoiceNumber?: string | null) =>
  Boolean(invoiceNumber?.match(COMPACT_INVOICE_NUMBER_PATTERN));

export const isUuid = (value?: string | null) => Boolean(value?.match(UUID_PATTERN));

export const formatInvoiceSequence = (prefix: string, sequence: number) =>
  `${prefix}${sequence < 1000 ? String(sequence).padStart(3, '0') : sequence}`;

export const getDisplayInvoiceNumber = (
  invoiceNumber: string | null | undefined,
  fallbackSequence: number,
  agencyName?: string | null,
  agencyId?: string | null
) => {
  if (isCompactInvoiceNumber(invoiceNumber)) return invoiceNumber;
  if (invoiceNumber && !isUuid(invoiceNumber)) return invoiceNumber;

  return formatInvoiceSequence(getAgencyInvoicePrefix(agencyName, agencyId), fallbackSequence);
};

export const getNextInvoiceNumber = async (
  supabaseClient: InvoiceNumberSupabaseClient,
  agencyId: string,
  agencyName?: string | null
) => {
  const { data: agencies, error: agenciesError } = await supabaseClient
    .from('agencies')
    .select('id, name')
    .order('name');

  if (agenciesError) throw agenciesError;

  const prefix = getUniqueAgencyInvoicePrefix(agencyId, agencies || [], agencyName);
  const { data, error } = await supabaseClient
    .from('invoices')
    .select('invoice_number')
    .eq('agency_id', agencyId)
    .like('invoice_number', `${prefix}%`);

  if (error) throw error;

  const maxSequence = (data || []).reduce((max: number, invoice: { invoice_number: string | null }) => {
    const invoiceNumber = invoice.invoice_number;
    if (!invoiceNumber?.startsWith(prefix)) return max;

    const sequence = Number(invoiceNumber.slice(3));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return formatInvoiceSequence(prefix, maxSequence + 1);
};
