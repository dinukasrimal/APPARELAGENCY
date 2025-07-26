import odooClient, { OdooConfig } from '@/integrations/odoo/client';
import { supabase } from '@/integrations/supabase/client';

export interface OdooProduct {
  id: number;
  name: string;
  list_price: number;
  default_code?: string;
  description?: string;
  categ_id?: [number, string];
  active: boolean;
  create_date: string;
  write_date: string;
}

export interface OdooPartner {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  country_id?: [number, string];
  customer: boolean;
  supplier: boolean;
  active: boolean;
}

export interface OdooSaleOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  date_order: string;
  amount_total: number;
  state: string;
  order_line: number[];
}

export interface OdooInvoice {
  id: number;
  name: string;
  partner_id: [number, string];
  partner_name?: string;
  partner_email?: string;
  partner_phone?: string;
  partner_street?: string;
  partner_city?: string;
  invoice_date: string;
  invoice_due_date?: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  currency_id?: [number, string];
  state: string; // draft, open, paid, cancelled
  payment_state?: string; // not_paid, paid, partial
  invoice_type?: string; // out_invoice, in_invoice, out_refund, in_refund
  reference?: string;
  notes?: string;
  terms_conditions?: string;
  invoice_line_ids: number[];
  create_date: string;
  write_date: string;
}

export interface OdooInvoiceLine {
  id: number;
  invoice_id: [number, string];
  product_id?: [number, string];
  product_name?: string;
  product_default_code?: string;
  name: string; // Description
  quantity: number;
  price_unit: number;
  price_subtotal: number;
  price_tax: number;
  price_total: number;
  discount?: number;
  uom_id?: [number, string];
  uom_name?: string;
  sequence: number;
}

export interface SyncResult {
  success: boolean;
  message: string;
  invoice_count: number;
  error_count: number;
  errors?: string[];
}

class OdooService {
  private isInitialized = false;

  /**
   * Initialize and authenticate with Odoo
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized && odooClient.isAuthenticated()) {
        return true;
      }

      const success = await odooClient.authenticate();
      this.isInitialized = success;
      return success;
    } catch (error) {
      console.error('Failed to initialize Odoo service:', error);
      return false;
    }
  }

  /**
   * Check if the service is authenticated
   */
  isAuthenticated(): boolean {
    return odooClient.isAuthenticated();
  }

  /**
   * Get authentication status and session info
   */
  getAuthStatus() {
    return {
      isAuthenticated: odooClient.isAuthenticated(),
      sessionInfo: odooClient.getSessionInfo(),
    };
  }

  // Product Operations
  async getProducts(limit = 50, offset = 0): Promise<OdooProduct[]> {
    await this.initialize();
    return odooClient.searchRead<OdooProduct>(
      'product.product',
      [['active', '=', true]],
      ['id', 'name', 'list_price', 'default_code', 'description', 'categ_id', 'active', 'create_date', 'write_date'],
      offset,
      limit,
      'name'
    );
  }

  async getProductById(id: number): Promise<OdooProduct | null> {
    await this.initialize();
    const products = await odooClient.read<OdooProduct>('product.product', [id]);
    return products.length > 0 ? products[0] : null;
  }

  async searchProducts(query: string, limit = 20): Promise<OdooProduct[]> {
    await this.initialize();
    const domain = [
      ['active', '=', true],
      '|',
      ['name', 'ilike', query],
      ['default_code', 'ilike', query]
    ];
    return odooClient.searchRead<OdooProduct>(
      'product.product',
      domain,
      ['id', 'name', 'list_price', 'default_code', 'description'],
      0,
      limit,
      'name'
    );
  }

  async createProduct(productData: Partial<OdooProduct>): Promise<number> {
    await this.initialize();
    return odooClient.create<number>('product.product', productData);
  }

  async updateProduct(id: number, productData: Partial<OdooProduct>): Promise<boolean> {
    await this.initialize();
    return odooClient.write<boolean>('product.product', id, productData);
  }

  async deleteProduct(id: number): Promise<boolean> {
    await this.initialize();
    return odooClient.unlink<boolean>('product.product', id);
  }

  // Partner Operations
  async getPartners(limit = 50, offset = 0): Promise<OdooPartner[]> {
    await this.initialize();
    return odooClient.searchRead<OdooPartner>(
      'res.partner',
      [['active', '=', true]],
      ['id', 'name', 'email', 'phone', 'street', 'city', 'country_id', 'customer', 'supplier', 'active'],
      offset,
      limit,
      'name'
    );
  }

  async getPartnerById(id: number): Promise<OdooPartner | null> {
    await this.initialize();
    const partners = await odooClient.read<OdooPartner>('res.partner', [id]);
    return partners.length > 0 ? partners[0] : null;
  }

  async searchPartners(query: string, limit = 20): Promise<OdooPartner[]> {
    await this.initialize();
    const domain = [
      ['active', '=', true],
      '|',
      ['name', 'ilike', query],
      ['email', 'ilike', query]
    ];
    return odooClient.searchRead<OdooPartner>(
      'res.partner',
      domain,
      ['id', 'name', 'email', 'phone', 'city'],
      0,
      limit,
      'name'
    );
  }

  async createPartner(partnerData: Partial<OdooPartner>): Promise<number> {
    await this.initialize();
    return odooClient.create<number>('res.partner', partnerData);
  }

  async updatePartner(id: number, partnerData: Partial<OdooPartner>): Promise<boolean> {
    await this.initialize();
    return odooClient.write<boolean>('res.partner', id, partnerData);
  }

  // Sale Order Operations
  async getSaleOrders(limit = 50, offset = 0): Promise<OdooSaleOrder[]> {
    await this.initialize();
    return odooClient.searchRead<OdooSaleOrder>(
      'sale.order',
      [],
      ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state', 'order_line'],
      offset,
      limit,
      'date_order desc'
    );
  }

  async getSaleOrderById(id: number): Promise<OdooSaleOrder | null> {
    await this.initialize();
    const orders = await odooClient.read<OdooSaleOrder>('sale.order', [id]);
    return orders.length > 0 ? orders[0] : null;
  }

  // Invoice Operations
  async getInvoices(limit = 50, offset = 0, domain: any[] = []): Promise<OdooInvoice[]> {
    await this.initialize();
    const defaultDomain = [['invoice_type', 'in', ['out_invoice', 'out_refund']]];
    const finalDomain = domain.length > 0 ? domain : defaultDomain;
    
    return odooClient.searchRead<OdooInvoice>(
      'account.move',
      finalDomain,
      [
        'id', 'name', 'partner_id', 'invoice_date', 'invoice_due_date',
        'amount_untaxed', 'amount_tax', 'amount_total', 'currency_id',
        'state', 'payment_state', 'invoice_type', 'reference', 'notes',
        'invoice_line_ids', 'create_date', 'write_date'
      ],
      offset,
      limit,
      'invoice_date desc'
    );
  }

  async getInvoiceById(id: number): Promise<OdooInvoice | null> {
    await this.initialize();
    const invoices = await odooClient.read<OdooInvoice>('account.move', [id]);
    return invoices.length > 0 ? invoices[0] : null;
  }

  async getInvoiceLines(invoiceId: number): Promise<OdooInvoiceLine[]> {
    await this.initialize();
    return odooClient.searchRead<OdooInvoiceLine>(
      'account.move.line',
      [['move_id', '=', invoiceId], ['exclude_from_invoice_tab', '=', false]],
      [
        'id', 'move_id', 'product_id', 'name', 'quantity', 'price_unit',
        'price_subtotal', 'price_tax', 'price_total', 'discount',
        'product_uom_id', 'sequence'
      ],
      0,
      0,
      'sequence'
    );
  }

  async getInvoicesByDateRange(startDate: string, endDate: string, limit = 100): Promise<OdooInvoice[]> {
    await this.initialize();
    const domain = [
      ['invoice_type', 'in', ['out_invoice', 'out_refund']],
      ['invoice_date', '>=', startDate],
      ['invoice_date', '<=', endDate]
    ];
    
    return this.getInvoices(limit, 0, domain);
  }

  // Sync Operations
  async syncInvoicesToSupabase(
    agencyId: string,
    startDate?: string,
    endDate?: string,
    limit = 100
  ): Promise<SyncResult> {
    try {
      await this.initialize();
      
      // Get invoices from Odoo
      const odooInvoices = startDate && endDate 
        ? await this.getInvoicesByDateRange(startDate, endDate, limit)
        : await this.getInvoices(limit);

      let invoiceCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const odooInvoice of odooInvoices) {
        try {
          // Check if invoice already exists in Supabase
          const { data: existingInvoice } = await supabase
            .from('odoo_invoices')
            .select('id')
            .eq('odoo_id', odooInvoice.id)
            .single();

          if (existingInvoice) {
            console.log(`Invoice ${odooInvoice.id} already exists, skipping...`);
            continue;
          }

          // Get partner details
          const partner = odooInvoice.partner_id ? await this.getPartnerById(odooInvoice.partner_id[0]) : null;

          // Get invoice lines
          const invoiceLines = await this.getInvoiceLines(odooInvoice.id);

          // Insert invoice into Supabase
          const { data: supabaseInvoice, error: invoiceError } = await supabase
            .from('odoo_invoices')
            .insert({
              odoo_id: odooInvoice.id,
              odoo_name: odooInvoice.name,
              partner_id: odooInvoice.partner_id?.[0] || null,
              partner_name: partner?.name || odooInvoice.partner_id?.[1] || 'Unknown',
              partner_email: partner?.email || null,
              partner_phone: partner?.phone || null,
              partner_address: partner?.street || null,
              invoice_date: odooInvoice.invoice_date,
              due_date: odooInvoice.invoice_due_date || null,
              amount_untaxed: odooInvoice.amount_untaxed,
              amount_tax: odooInvoice.amount_tax,
              amount_total: odooInvoice.amount_total,
              currency_id: odooInvoice.currency_id?.[0] || null,
              currency_symbol: odooInvoice.currency_id?.[1] || '$',
              state: odooInvoice.state,
              payment_state: odooInvoice.payment_state || 'not_paid',
              invoice_type: odooInvoice.invoice_type || 'out_invoice',
              reference: odooInvoice.reference || null,
              notes: odooInvoice.notes || null,
              terms_conditions: odooInvoice.terms_conditions || null,
              agency_id: agencyId,
              sync_status: 'synced'
            })
            .select()
            .single();

          if (invoiceError) {
            throw new Error(`Failed to insert invoice: ${invoiceError.message}`);
          }

          // Insert invoice lines
          if (invoiceLines.length > 0 && supabaseInvoice) {
            const invoiceItems = invoiceLines.map(line => ({
              odoo_invoice_id: supabaseInvoice.id,
              odoo_product_id: line.product_id?.[0] || null,
              product_name: line.product_name || line.name,
              product_default_code: line.product_default_code || null,
              description: line.name,
              quantity: line.quantity,
              unit_price: line.price_unit,
              price_subtotal: line.price_subtotal,
              price_tax: line.price_tax,
              price_total: line.price_total,
              discount: line.discount || 0,
              uom_id: line.uom_id?.[0] || null,
              uom_name: line.uom_name || null,
              sequence: line.sequence
            }));

            const { error: itemsError } = await supabase
              .from('odoo_invoice_items')
              .insert(invoiceItems);

            if (itemsError) {
              throw new Error(`Failed to insert invoice items: ${itemsError.message}`);
            }
          }

          invoiceCount++;
          console.log(`Successfully synced invoice ${odooInvoice.id}`);

        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Invoice ${odooInvoice.id}: ${errorMessage}`);
          console.error(`Failed to sync invoice ${odooInvoice.id}:`, error);
        }
      }

      return {
        success: errorCount === 0,
        message: `Synced ${invoiceCount} invoices successfully${errorCount > 0 ? ` with ${errorCount} errors` : ''}`,
        invoice_count: invoiceCount,
        error_count: errorCount,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('Failed to sync invoices:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        invoice_count: 0,
        error_count: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Generic Operations
  async callMethod<T = any>(
    model: string,
    method: string,
    params: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<T> {
    await this.initialize();
    return odooClient.callMethod<T>(model, method, params, kwargs);
  }

  async searchRead<T = any>(
    model: string,
    domain: any[] = [],
    fields: string[] = [],
    offset: number = 0,
    limit: number = 0,
    order: string = ''
  ): Promise<T[]> {
    await this.initialize();
    return odooClient.searchRead<T>(model, domain, fields, offset, limit, order);
  }

  async count(model: string, domain: any[] = []): Promise<number> {
    await this.initialize();
    return odooClient.count(model, domain);
  }
}

export const odooService = new OdooService();
export default odooService; 