import { supabase } from '@/integrations/supabase/client';

export interface ExternalInventoryItem {
  product_name: string;
  original_product_name?: string; // Original product name from external_inventory_management for matching
  product_code: string | null;
  color: string; // Contains comma-separated values for consolidated view
  size: string; // Contains comma-separated values for consolidated view
  category: string | null;
  sub_category: string | null;
  // matched_product_id removed - using direct relationship via product_name = products.description
  current_stock: number;
  total_stock_in: number;
  total_stock_out: number;
  avg_unit_price: number;
  transaction_count: number;
  variant_count?: number; // Number of color/size combinations
  last_transaction_date: string;
  first_transaction_date: string;
  sources?: string; // Comma-separated transaction sources
  transaction_types?: string; // Comma-separated transaction types
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'; // Calculated status
  total_value?: number; // current_stock * avg_unit_price
}

export interface ExternalInventoryTransaction {
  id: string;
  product_name: string;
  product_code: string | null;
  color: string;
  size: string;
  category: string | null;
  transaction_type: string;
  quantity: number;
  movement_type: string;
  reference_name: string | null;
  user_name: string | null;
  transaction_date: string;
  external_source: string | null;
  external_id: string | null;
  notes: string | null;
  agency_id: string;
  unit_price?: number | null;
  approval_status?: string | null;
}

export interface ExternalInventoryByType {
  product_name: string;
  color: string;
  size: string;
  transaction_type: string;
  net_quantity: number;
  transaction_count: number;
  avg_price: number;
  last_transaction: string;
}

export interface ExternalInventoryMetrics {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalTransactions: number;
}

// ── Grouping helpers, mirroring buildAgencyStockSummaryFromTransactions so the
//    per-item movement history matches the aggregated stock exactly. The item
//    the UI shows is grouped by normalized base-name + size (colors merged), so
//    the history must group raw transactions the same way. ────────────────────
// Packaging suffixes trail the size token, either bracketed ("TRUNK L (2
// PACK)") or bare ("DAG GIRLS KNICKERS 2-4 3PACK"), so every end-anchored
// size/name regex below must strip them first or it silently fails to find the
// size — stranding "Default"-tagged stock count rows in their own bucket
// instead of merging with the sized rows. The bare form requires a space or
// dash before the pack count so real words ending in "PACK" survive.
const _stripPackagingSuffix = (name: string): string =>
  name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[\s-]+\d*\s*PACK\s*$/i, '')
    .trim();

// A trailing size token, however it is attached to the name: "VEST -105",
// "VEST 105", "APEX - L", "KNICKERS 2-4". Longer letter sizes come first so
// XXL wins over XL, and the numeric range before the single number.
const _SIZE_TOKEN = String.raw`XXXL|XXL|4XL|5XL|2XL|3XL|XS|XL|S|M|L|\d{1,3}\s*[-–]\s*\d{1,3}|\d{1,3}`;

// Odoo writes some sizes as XXL/XXXL where the catalogue says 2XL/3XL. They are
// the same size, so one spelling wins or the product shows up as two lines.
const _canonicalSizeToken = (token: string): string => {
  const t = token.toUpperCase().replace(/\s+/g, '').replace(/–/g, '-');
  if (t === 'XXL') return '2XL';
  if (t === 'XXXL') return '3XL';
  return t;
};

const _extractFirstLevelSize = (productName: string, sizeField: string): string => {
  if (sizeField && sizeField !== 'Default') return _canonicalSizeToken(sizeField);
  productName = _stripPackagingSuffix(productName);
  const sizeMatch = productName.match(new RegExp(`[\\s-]+(${_SIZE_TOKEN})$`, 'i'));
  if (sizeMatch) return _canonicalSizeToken(sizeMatch[1]);
  const afterColorSizeMatch = productName.match(new RegExp(`-[A-Z]+\\s+(${_SIZE_TOKEN})$`, 'i'));
  if (afterColorSizeMatch) return _canonicalSizeToken(afterColorSizeMatch[1]);
  return 'Default';
};
// A handful of products reach us under a shortened name that is not in the
// catalogue — Odoo deducts the sale as "BLACK VEST LESS 65" while the stock
// arrived as "BLACK VEST SLEEVE LESS 65". Left alone, one product shows up as
// two inventory lines, the stray one permanently negative and the real one
// overstated by the same amount. Map the stray base name onto the catalogue
// one; add an entry here when another stray name turns up.
const _BASE_NAME_ALIASES: Record<string, string> = {
  'BLACK VEST LESS': 'BLACK VEST SLEEVE LESS',
};

// The label for a merged line: never the stray name, always the catalogue one.
const _canonicalProductName = (name: string | null | undefined): string => {
  if (!name) return name || '';
  let canonical = name;
  for (const [alias, target] of Object.entries(_BASE_NAME_ALIASES)) {
    canonical = canonical.replace(new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), target);
  }
  return canonical;
};

// True when this name is one of the stray spellings above, so a merged line can
// always prefer the catalogue spelling (and its code) for its label.
const _isAliasedName = (name: string | null | undefined): boolean =>
  !!name && _canonicalProductName(name) !== name;

const _normalizeBaseName = (name: string | null | undefined): string => {
  if (!name) return '';
  let base = _stripPackagingSuffix(name.replace(/^\[[^\]]+\]\s*/, '').trim());
  base = base.replace(new RegExp(`[\\s-]+(?:${_SIZE_TOKEN})$`, 'i'), '').trim();
  base = base.replace(/[-\s]+$/, '').trim();
  base = base.replace(/[-_\s]+/g, ' ').toUpperCase();
  return _BASE_NAME_ALIASES[base] ?? base;
};
const _normalizeSize = (size: string | null | undefined): string => {
  if (!size) return '';
  const s = size.toUpperCase().trim();
  if (s === 'DEFAULT' || /FREE\s*SIZE/.test(s) || /ONE\s*SIZE/.test(s)) return '';
  return _canonicalSizeToken(s);
};
const _extractSizeFromName = (name: string | null | undefined): string => {
  if (!name) return '';
  const match = _stripPackagingSuffix(name)
    .match(new RegExp(`(?:^|[\\s-])(XXXL|XXL|4XL|5XL|2XL|3XL|XS|XL|S|M|L|\\d{1,3}\\s*[-–]\\s*\\d{1,3}|\\d{2,3})\\s*$`, 'i'));
  return match ? _canonicalSizeToken(match[1]) : '';
};
// Second-level group key (ignores color, exactly like the summary builder).
const _itemGroupKey = (displayName: string, firstLevelSize: string): string => {
  const baseName = _normalizeBaseName(displayName);
  const sizeKey = _normalizeSize(firstLevelSize) || _extractSizeFromName(displayName) || 'NOSIZE';
  return `name:${baseName}|size:${sizeKey}`;
};

// ── Public stock resolution ────────────────────────────────────────────────
// The canonical identity of an inventory line: normalized base product name +
// size, with colours merged — the exact key the stock summary groups by. Any
// screen that needs "how much stock does this agency have of product X in size
// Y" must resolve it through here, so the number it shows is always the same
// number the Inventory screen shows for that product.
export const inventoryGroupKey = (productName?: string | null, size?: string | null): string =>
  _itemGroupKey(productName || '', size || '');

// The product family a line belongs to, for grouping rows in a list. Shares the
// name rules above, so a packaging suffix or a dash before the size can't leave
// the size in the family name and scatter a product's sizes alphabetically.
export const inventoryBaseName = (productName?: string | null): string =>
  _normalizeBaseName(productName);

// Sort rank for a size, so a family reads S, M, L, XL, 2XL... and 22, 24, 26...
// rather than in label order. Three bands, each sorted inside itself: letter
// sizes in wearing order, plain numbers numerically, then ranges ("10-12") by
// their first number. Anything unrecognised sorts last.
const _LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
export const inventorySizeRank = (size?: string | null, productName?: string | null): number => {
  // A merged line's size reads MULTI or Default; its name still carries the size.
  const s = (_normalizeSize(size) === 'MULTI' ? '' : _normalizeSize(size)) || _extractSizeFromName(productName);
  if (!s) return Number.MAX_SAFE_INTEGER;

  const letter = _LETTER_SIZES.indexOf(s);
  if (letter !== -1) return letter;

  const range = s.match(/^(\d+)\s*-\s*\d+$/);
  if (range) return 2000 + Number(range[1]);

  const n = Number(s);
  if (!Number.isNaN(n)) return 1000 + n;

  return Number.MAX_SAFE_INTEGER;
};

// Turns a stock summary (from getStockSummary / getAgencyStockSummary) into a
// lookup keyed by inventoryGroupKey, so callers read the summary's own
// current_stock rather than re-deriving stock with their own matching rules.
export const buildStockLookup = (items: ExternalInventoryItem[]): Map<string, number> => {
  const lookup = new Map<string, number>();
  items.forEach((item) => {
    const stock = Number(item.current_stock) || 0;
    // A merged row can carry the label 'MULTI' instead of a real size; treat it
    // like 'Default' so the size is recovered from the name, keeping the key
    // identical to the one the row was actually grouped under.
    const size = (item.size || '').toUpperCase() === 'MULTI' ? '' : item.size;
    lookup.set(inventoryGroupKey(item.product_name, size), stock);
    // product_name is the display name (products.name); index the raw
    // transaction name too so rows with no products mapping still resolve.
    if (item.original_product_name) {
      const rawKey = inventoryGroupKey(item.original_product_name, size);
      if (!lookup.has(rawKey)) lookup.set(rawKey, stock);
    }
  });
  return lookup;
};

// Stock for one catalog product/size, resolved against a lookup built above.
// Tries the product's name then its description, since an inventory line's
// display name comes from whichever of the two matched the transaction.
export const lookupProductStock = (
  lookup: Map<string, number>,
  product: { name?: string | null; description?: string | null },
  size?: string | null
): number => {
  const byName = lookup.get(inventoryGroupKey(product.name, size));
  if (byName !== undefined) return byName;
  const byDescription = product.description
    ? lookup.get(inventoryGroupKey(product.description, size))
    : undefined;
  // Not in the summary at all means no stock movements were ever recorded for
  // it, which is exactly how the Inventory screen treats it: no line, no stock.
  return byDescription ?? 0;
};

export class ExternalInventoryService {

  // Helper method to calculate stock status
  private calculateStockStatus(currentStock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (currentStock <= 0) return 'out_of_stock';
    if (currentStock <= 5) return 'low_stock';
    return 'in_stock';
  }

  // Product names (matching external_inventory_management.product_name) that a
  // superuser has flagged as retired — excluded from every inventory summary
  // and total, without deleting the underlying transaction history.
  private async getIgnoredProductNames(): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('inventory_ignored_products')
      .select('product_name');

    if (error) {
      console.warn('Error fetching ignored inventory products:', error);
      return new Set();
    }

    return new Set((data || []).map(row => row.product_name));
  }

  // No longer needed - using direct relationship via product_name = products.description
  
  // Get stock summary for a user based on their profile name matching reference_name
  async getStockSummary(userId: string, forceRefresh: boolean = false): Promise<ExternalInventoryItem[]> {
    // Add cache-busting parameter to ensure fresh data
    if (forceRefresh) {
      // Small delay to ensure database has processed recent changes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.buildStockSummaryFromTransactions(userId);
  }

  // Get all stock for an agency (superuser only) - no reference_name filtering
  async getAgencyStockSummary(agencyId: string, forceRefresh: boolean = false): Promise<ExternalInventoryItem[]> {
    if (forceRefresh) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.buildAgencyStockSummaryFromTransactions(agencyId);
  }

  // Helper method to build stock summary for entire agency (superuser only)
  private async buildAgencyStockSummaryFromTransactions(agencyId: string, filters?: { searchTerm?: string; category?: string }): Promise<ExternalInventoryItem[]> {
    console.log(`🔍 Debug: Getting ALL stock for agency ${agencyId} (superuser mode)`);

    const PAGE_SIZE = 1000;

    const fetchPage = async (from: number, to: number) => {
      let pageQuery = supabase
        .from('external_inventory_management')
        .select(`
          product_name,
          product_code,
          color,
          size,
          category,
          sub_category,
          unit_price,
          quantity,
          transaction_date,
          external_source,
          transaction_type,
          reference_name
        `, { count: 'exact' })
        .eq('agency_id', agencyId)
        .eq('approval_status', 'approved'); // Only approved transactions affect stock

      // Apply filters per page
      if (filters?.searchTerm) {
        pageQuery = pageQuery.ilike('product_name', `%${filters.searchTerm}%`);
      }

      if (filters?.category) {
        pageQuery = pageQuery.eq('sub_category', filters.category);
      }

      return pageQuery.range(from, to);
    };

    // Fetch first page
    const firstPage = await fetchPage(0, PAGE_SIZE - 1);

    if (firstPage.error) {
      console.error('Error fetching agency transactions:', firstPage.error);
      throw firstPage.error;
    }

    let data: any[] = firstPage.data || [];
    const totalCount = firstPage.count ?? data.length;

    // Fetch remaining pages
    while (data.length < totalCount) {
      const from = data.length;
      const to = from + PAGE_SIZE - 1;
      const page = await fetchPage(from, to);
      if (page.error) {
        console.error('Error fetching paginated agency transactions:', page.error);
        throw page.error;
      }
      data.push(...(page.data || []));
    }

    console.log(`🔍 Debug: Fetched ${data.length} transactions for agency ${agencyId}`);
    if (data && data.length > 0) {
      console.log(`🔍 Debug: Sample transactions:`, data.slice(0, 3));
    } else {
      console.log(`⚠️ Debug: No transactions found for agency ${agencyId} - this agency will show empty inventory`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Drop retired/renamed products that a superuser has explicitly flagged —
    // their transaction history stays in the DB, just not in this summary.
    const ignoredProductNames = await this.getIgnoredProductNames();
    if (ignoredProductNames.size > 0) {
      data = data.filter(item => !ignoredProductNames.has(item.product_name));
    }
    if (data.length === 0) {
      return [];
    }

    // Get unique product names and fetch their corresponding products table data  
    const uniqueProductNames = [...new Set(data.map(item => item.product_name))];
    
    // Fetch products data for all unique product names
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('description, name, sub_category')
      .in('description', uniqueProductNames);

    if (productsError) {
      console.error('Error fetching products data:', productsError);
    }

    // Create a lookup map for products
    const productsMap = new Map();
    productsData?.forEach(product => {
      productsMap.set(product.description, {
        displayName: product.name,
        subCategory: product.sub_category
      });
    });

    // Size resolution lives in _extractFirstLevelSize so the summary, the
    // movement history and every stock lookup read sizes identically.
    const extractSize = _extractFirstLevelSize;

    // Helper function to normalize color
    const normalizeColor = (color: string, productName: string): string => {
      if (color && color !== 'Default') {
        return color.toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }

      productName = _stripPackagingSuffix(productName);

      const colorAfterDashMatch = productName.match(/-([A-Z]+)\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i);
      if (colorAfterDashMatch) {
        return colorAfterDashMatch[1].toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }

      const colorAfterDashNoSizeMatch = productName.match(/-([A-Z]+)$/i);
      if (colorAfterDashNoSizeMatch) {
        return colorAfterDashNoSizeMatch[1].toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }

      return 'Default';
    };

    // Helper function to normalize product code
    const normalizeProductCode = (productCode: string | null, productName: string): string | null => {
      if (productCode) {
        return productCode.toUpperCase();
      }
      
      const codeMatch = productName.match(/\[([^\]]+)\]/);
      if (codeMatch) {
        return codeMatch[1].toUpperCase();
      }
      
      return null;
    };

    // Helper function to create normalized base product name
    const createBaseProductName = (productName: string): string => {
      let baseName = productName.replace(/^\[[^\]]+\]\s*/, '');
      baseName = baseName.replace(new RegExp(`-[A-Z]+[\\s-]+(?:${_SIZE_TOKEN})$`, 'i'), '');
      baseName = baseName.replace(new RegExp(`[\\s-]+(?:${_SIZE_TOKEN})$`, 'i'), '');
      baseName = baseName.replace(/-[A-Z]+$/i, '');
      return baseName.trim();
    };

    // Group transactions by product variant
    const groupedData = new Map<string, any>();
    
    data.forEach(transaction => {
      const normalizedColor = normalizeColor(transaction.color, transaction.product_name);
      const normalizedSize = extractSize(transaction.product_name, transaction.size);
      const normalizedCode = normalizeProductCode(transaction.product_code, transaction.product_name);
      
      // Get product info from products table
      const productInfo = productsMap.get(transaction.product_name);
      const displayName = productInfo?.displayName || transaction.product_name;
      // Prefer transaction's sub_category, then product mapping, then category fallback
      const subCategory = transaction.sub_category || productInfo?.subCategory || transaction.category || 'General';
      
      const key = `${transaction.product_name}|${normalizedColor}|${normalizedSize}`;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, {
          product_name: displayName, // Use products.name for display
          original_product_name: transaction.product_name, // Keep original for matching
          product_code: normalizedCode,
          color: normalizedColor,
          size: normalizedSize,
          category: transaction.category || 'General',
          sub_category: subCategory, // Use products.sub_category
          current_stock: 0,
          total_stock_in: 0,
          total_stock_out: 0,
          transaction_count: 0,
          variant_count: 1,
          avg_unit_price: 0,
          last_transaction_date: transaction.transaction_date,
          first_transaction_date: transaction.transaction_date,
          sources: new Set(),
          transaction_types: new Set(),
          price_sum: 0,
          price_count: 0
        });
      }
      
      const item = groupedData.get(key)!;
      // Upgrade sub_category/category if we previously had a generic value
      if ((item.sub_category === 'General' || !item.sub_category) && subCategory && subCategory !== 'General') {
        item.sub_category = subCategory;
      }
      if ((item.category === 'General' || !item.category) && transaction.category) {
        item.category = transaction.category;
      }

      item.current_stock += transaction.quantity;
      item.transaction_count++;
      
      if (transaction.quantity > 0) {
        item.total_stock_in += transaction.quantity;
      } else {
        item.total_stock_out += Math.abs(transaction.quantity);
      }
      
      if (transaction.unit_price > 0) {
        item.price_sum += transaction.unit_price;
        item.price_count++;
        item.avg_unit_price = item.price_sum / item.price_count;
      }
      
      if (transaction.transaction_date > item.last_transaction_date) {
        item.last_transaction_date = transaction.transaction_date;
      }
      if (transaction.transaction_date < item.first_transaction_date) {
        item.first_transaction_date = transaction.transaction_date;
      }
      
      item.sources.add(transaction.external_source);
      item.transaction_types.add(transaction.transaction_type);
    });

    // Convert to array and clean up
    const initialItems = Array.from(groupedData.values()).map(item => ({
      ...item,
      sources: Array.from(item.sources).join(', '),
      transaction_types: Array.from(item.transaction_types).join(', '),
      stock_status: this.calculateStockStatus(item.current_stock),
      total_value: item.current_stock * (item.avg_unit_price || 0)
    }));

    // Second‑level aggregation: merge items by normalized product name + normalized size (ignore product_code/ids)
    const aggregatedMap = new Map<string, any>();

    initialItems.forEach(item => {
      // One shared key (see _itemGroupKey) so this aggregation, the movement
      // history and the sale-order stock helper can never disagree.
      const key = _itemGroupKey(item.product_name, item.size);
      if (!aggregatedMap.has(key)) {
        aggregatedMap.set(key, {
          ...item,
          product_name: _canonicalProductName(item.product_name),
          label_from_alias: _isAliasedName(item.product_name),
        });
      } else {
        const existing = aggregatedMap.get(key)!;

        // If the line is currently labelled from a stray name like "[BVL65]
        // BLACK VEST LESS 65", take the catalogue name and code instead.
        if (existing.label_from_alias && !_isAliasedName(item.product_name)) {
          existing.product_name = item.product_name;
          existing.label_from_alias = false;
        }

        const combinedStock = existing.current_stock + item.current_stock;

        existing.current_stock = combinedStock;
        existing.total_stock_in += item.total_stock_in;
        existing.total_stock_out += item.total_stock_out;
        existing.transaction_count += item.transaction_count;
        existing.variant_count += item.variant_count ?? 0;

        // Prefer non-default colors/sizes; else mark MULTI
        if (existing.color !== item.color) {
          if (existing.color === 'Default') existing.color = item.color;
          else if (item.color === 'Default') existing.color = existing.color;
          else existing.color = 'MULTI';
        }
        if (existing.size !== item.size) {
          if (existing.size === 'Default') existing.size = item.size;
          else if (item.size === 'Default') existing.size = existing.size;
          else existing.size = 'MULTI';
        }

        // Average the actual unit prices (always ≥ 0), NOT value/stock — the
        // latter goes negative when a variant is oversold (negative stock),
        // which produced bogus negative Avg Price / Total Value.
        existing.price_sum = (existing.price_sum || 0) + (item.price_sum || 0);
        existing.price_count = (existing.price_count || 0) + (item.price_count || 0);
        existing.avg_unit_price = existing.price_count > 0
          ? existing.price_sum / existing.price_count
          : (existing.avg_unit_price ?? item.avg_unit_price ?? 0);

        existing.total_value = combinedStock * existing.avg_unit_price;
        existing.stock_status = this.calculateStockStatus(combinedStock);
      }
    });

    return Array.from(aggregatedMap.values());
  }

  // Helper method to build stock summary from raw transactions filtered by user profile name  
  private async buildStockSummaryFromTransactions(userId: string, filters?: { searchTerm?: string; category?: string }): Promise<ExternalInventoryItem[]> {
    // First get the user's profile name
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('name, agency_id')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('Error getting user profile:', profileError);
      return [];
    }

    const userProfileName = profileData.name;
    const agencyId = profileData.agency_id;
    
    if (!userProfileName) {
      console.warn('User profile has no name');
      return [];
    }

    console.log(`🔍 Debug: Loading inventory for agency ${agencyId} (all approved transactions, no reference_name filter)`);

    const PAGE_SIZE = 1000;

    const fetchPage = async (from: number, to: number) => {
      let pageQuery = supabase
        .from('external_inventory_management')
        .select(`
          product_name,
          product_code,
          color,
          size,
          category,
          sub_category,
          unit_price,
          quantity,
          transaction_date,
          external_source,
          transaction_type,
          reference_name
        `, { count: 'exact' })
        .eq('agency_id', agencyId)
        .eq('approval_status', 'approved'); // Only approved transactions affect stock

      // Apply filters per page
      if (filters?.searchTerm) {
        pageQuery = pageQuery.ilike('product_name', `%${filters.searchTerm}%`);
      }
      if (filters?.category) {
        pageQuery = pageQuery.eq('sub_category', filters.category);
      }

      return pageQuery.range(from, to);
    };

    // Fetch first page
    const firstPage = await fetchPage(0, PAGE_SIZE - 1);
    if (firstPage.error) {
      console.error('Error fetching external inventory transactions:', firstPage.error);
      throw firstPage.error;
    }

    let transactions: any[] = firstPage.data || [];
    const totalCount = firstPage.count ?? transactions.length;

    // Fetch remaining pages if needed
    while (transactions.length < totalCount) {
      const from = transactions.length;
      const to = from + PAGE_SIZE - 1;
      const page = await fetchPage(from, to);
      if (page.error) {
        console.error('Error fetching paginated transactions:', page.error);
        throw page.error;
      }
      transactions.push(...(page.data || []));
    }

    console.log(`🔍 Debug: Fetched ${transactions.length} transactions for agency ${agencyId}`);
    if (transactions && transactions.length > 0) {
      console.log('🔍 Debug: Sample transactions:', transactions.slice(0, 3));
      
      // Debug: Check for recent BRITNY-BLACK L transactions
      const britnyTransactions = transactions.filter(t => 
        t.product_name?.includes('BRITNY') && t.color === 'BLACK' && t.size === 'L'
      );
      console.log('🔍 Debug: BRITNY-BLACK L transactions:', britnyTransactions);
      
      // Debug: Check for sale transactions
      const saleTransactions = transactions.filter(t => t.transaction_type === 'sale');
      console.log('🔍 Debug: Sale transactions found:', saleTransactions.length);
      if (saleTransactions.length > 0) {
        console.log('🔍 Debug: Sample sale transactions:', saleTransactions.slice(-3));
      }
    } else {
      console.log(`⚠️ Debug: No transactions found for agency ${agencyId} - this agency will show empty inventory`);
    }

    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Drop retired/renamed products that a superuser has explicitly flagged —
    // their transaction history stays in the DB, just not in this summary.
    const ignoredProductNames = await this.getIgnoredProductNames();
    if (ignoredProductNames.size > 0) {
      transactions = transactions.filter(item => !ignoredProductNames.has(item.product_name));
    }
    if (transactions.length === 0) {
      return [];
    }

    // Get unique product names and fetch their corresponding products table data  
    const uniqueProductNames = [...new Set(transactions.map(item => item.product_name))];
    
    // Fetch products data for all unique product names
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('description, name, sub_category')
      .in('description', uniqueProductNames);

    if (productsError) {
      console.error('Error fetching products data:', productsError);
    }

    // Create a lookup map for products
    const productsMap = new Map();
    productsData?.forEach(product => {
      productsMap.set(product.description, {
        displayName: product.name,
        subCategory: product.sub_category
      });
    });

    // Size resolution lives in _extractFirstLevelSize so the summary, the
    // movement history and every stock lookup read sizes identically.
    const extractSize = _extractFirstLevelSize;

    // Helper function to normalize color
    const normalizeColor = (color: string, productName: string): string => {
      // If color field is not "Default", use it
      if (color && color !== 'Default') {
        // Normalize common color spelling variations
        return color.toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }

      productName = _stripPackagingSuffix(productName);

      // Extract color from product name patterns
      // Pattern 1: "PRODUCT-COLOR SIZE" (e.g., "SOLACE-BEIGH 28")
      const colorAfterDashMatch = productName.match(/-([A-Z]+)\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i);
      if (colorAfterDashMatch) {
        return colorAfterDashMatch[1].toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }

      // Pattern 2: "PRODUCT-COLOR" without size (e.g., "SHORTS-BLACK")
      const colorAfterDashNoSizeMatch = productName.match(/-([A-Z]+)$/i);
      if (colorAfterDashNoSizeMatch) {
        return colorAfterDashNoSizeMatch[1].toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }

      return 'Default';
    };

    // Helper function to normalize product code
    const normalizeProductCode = (productCode: string | null, productName: string): string | null => {
      if (productCode) {
        return productCode.toUpperCase();
      }
      
      // Extract product code from brackets in product name
      const codeMatch = productName.match(/\[([^\]]+)\]/);
      if (codeMatch) {
        return codeMatch[1].toUpperCase();
      }
      
      return null;
    };

    // Helper function to create normalized base product name
    const createBaseProductName = (productName: string): string => {
      // Remove product code in brackets
      let baseName = productName.replace(/^\[[^\]]+\]\s*/, '');
      
      // Remove color and size patterns
      // Pattern 1: Remove "-COLOR SIZE" at the end
      baseName = baseName.replace(new RegExp(`-[A-Z]+[\\s-]+(?:${_SIZE_TOKEN})$`, 'i'), '');
      
      // Pattern 2: Remove just size at the end if no color pattern matched
      baseName = baseName.replace(new RegExp(`[\\s-]+(?:${_SIZE_TOKEN})$`, 'i'), '');
      
      // Pattern 3: Remove just "-COLOR" at the end if no size
      baseName = baseName.replace(/-[A-Z]+$/i, '');
      
      return baseName.trim();
    };

    // Group transactions by product variant (name + normalized color + normalized size)
    const groupedData = new Map<string, any>();
    
    transactions?.forEach(transaction => {
      const normalizedColor = normalizeColor(transaction.color, transaction.product_name);
      const normalizedSize = extractSize(transaction.product_name, transaction.size);
      const normalizedCode = normalizeProductCode(transaction.product_code, transaction.product_name);
      
      // Get product info from products table
      const productInfo = productsMap.get(transaction.product_name);
      const displayName = productInfo?.displayName || transaction.product_name;
      // Prefer transaction's sub_category, then product mapping, then category fallback
      const subCategory = transaction.sub_category || productInfo?.subCategory || transaction.category || 'General';
      
      const key = `${transaction.product_name}|${normalizedColor}|${normalizedSize}`;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, {
          product_name: displayName, // Use products.name for display
          original_product_name: transaction.product_name, // Keep original for matching
          product_code: normalizedCode,
          color: normalizedColor,
          size: normalizedSize,
          category: transaction.category || 'General',
          sub_category: subCategory, // Use products.sub_category
          current_stock: 0,
          total_stock_in: 0,
          total_stock_out: 0,
          transaction_count: 0,
          variant_count: 1,
          avg_unit_price: 0,
          last_transaction_date: transaction.transaction_date,
          first_transaction_date: transaction.transaction_date,
          sources: new Set(),
          transaction_types: new Set(),
          price_sum: 0,
          price_count: 0
        });
      }
      
      const item = groupedData.get(key)!;
      // Upgrade sub_category/category if we previously had a generic value
      if ((item.sub_category === 'General' || !item.sub_category) && subCategory && subCategory !== 'General') {
        item.sub_category = subCategory;
      }
      if ((item.category === 'General' || !item.category) && transaction.category) {
        item.category = transaction.category;
      }
      
      // Debug specific product
      if (transaction.product_name?.includes('BRITNY') && normalizedColor === 'BLACK' && normalizedSize === 'L') {
        console.log('🔍 Debug: Processing BRITNY-BLACK L transaction:', {
          type: transaction.transaction_type,
          quantity: transaction.quantity,
          currentStock: item.current_stock,
          newStock: item.current_stock + transaction.quantity,
          transactionDate: transaction.transaction_date,
          key: key
        });
      }
      
      item.current_stock += transaction.quantity;
      item.transaction_count++;
      
      if (transaction.quantity > 0) {
        item.total_stock_in += transaction.quantity;
      } else {
        item.total_stock_out += Math.abs(transaction.quantity);
      }
      
      if (transaction.unit_price > 0) {
        item.price_sum += transaction.unit_price;
        item.price_count++;
        item.avg_unit_price = item.price_sum / item.price_count;
      }
      
      if (transaction.transaction_date > item.last_transaction_date) {
        item.last_transaction_date = transaction.transaction_date;
      }
      if (transaction.transaction_date < item.first_transaction_date) {
        item.first_transaction_date = transaction.transaction_date;
      }
      
      item.sources.add(transaction.external_source);
      item.transaction_types.add(transaction.transaction_type);
    });

    // Convert to array and clean up
    const initialItems = Array.from(groupedData.values()).map(item => ({
      ...item,
      sources: Array.from(item.sources).join(', '),
      transaction_types: Array.from(item.transaction_types).join(', '),
      stock_status: this.calculateStockStatus(item.current_stock),
      total_value: item.current_stock * (item.avg_unit_price || 0)
    }));

    // Second‑level aggregation: merge items by normalized product name + normalized size for this user (ignore product_code)
    const aggregatedMap = new Map<string, any>();

    initialItems.forEach(item => {
      // One shared key (see _itemGroupKey) so this aggregation, the movement
      // history and the sale-order stock helper can never disagree.
      const key = _itemGroupKey(item.product_name, item.size);
      if (!aggregatedMap.has(key)) {
        aggregatedMap.set(key, {
          ...item,
          product_name: _canonicalProductName(item.product_name),
          label_from_alias: _isAliasedName(item.product_name),
        });
      } else {
        const existing = aggregatedMap.get(key)!;

        // If the line is currently labelled from a stray name like "[BVL65]
        // BLACK VEST LESS 65", take the catalogue name and code instead.
        if (existing.label_from_alias && !_isAliasedName(item.product_name)) {
          existing.product_name = item.product_name;
          existing.label_from_alias = false;
        }

        const combinedStock = existing.current_stock + item.current_stock;

        existing.current_stock = combinedStock;
        existing.total_stock_in += item.total_stock_in;
        existing.total_stock_out += item.total_stock_out;
        existing.transaction_count += item.transaction_count;
        existing.variant_count += item.variant_count ?? 0;

        if (existing.color !== item.color) {
          if (existing.color === 'Default') existing.color = item.color;
          else if (item.color === 'Default') existing.color = existing.color;
          else existing.color = 'MULTI';
        }
        if (existing.size !== item.size) {
          if (existing.size === 'Default') existing.size = item.size;
          else if (item.size === 'Default') existing.size = existing.size;
          else existing.size = 'MULTI';
        }

        // Average the actual unit prices (always ≥ 0), NOT value/stock — the
        // latter goes negative when a variant is oversold (negative stock).
        existing.price_sum = (existing.price_sum || 0) + (item.price_sum || 0);
        existing.price_count = (existing.price_count || 0) + (item.price_count || 0);
        existing.avg_unit_price = existing.price_count > 0
          ? existing.price_sum / existing.price_count
          : (existing.avg_unit_price ?? item.avg_unit_price ?? 0);

        existing.total_value = combinedStock * existing.avg_unit_price;
        existing.stock_status = this.calculateStockStatus(combinedStock);
      }
    });

    const result = Array.from(aggregatedMap.values());
    
    // Debug: Check final BRITNY-BLACK L result for user-specific function
    const britnyResult = result.find(item => 
      item.product_name?.includes('BRITNY') && item.color === 'BLACK' && item.size === 'L'
    );
    if (britnyResult) {
      console.log('🔍 Debug: Final USER-SPECIFIC BRITNY-BLACK L stock result:', britnyResult);
    }
    
    return result;
  }

  // Get transaction history for an agency (include all statuses for history)
  async getTransactionHistory(agencyId: string, limit: number = 50): Promise<ExternalInventoryTransaction[]> {
    const { data, error } = await supabase
      .from('external_inventory_management')
      .select(`
        id,
        product_name,
        product_code,
        color,
        size,
        category,
        sub_category,
        unit_price,
        quantity,
        transaction_date,
        external_source,
        transaction_type,
        reference_name,
        approval_status,
        user_name,
        notes
      `)
      .eq('agency_id', agencyId)
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching external inventory transactions:', error);
      throw error;
    }

    return data || [];
  }

  // Full movement / transaction history for one DISPLAYED item. Because the item
  // is an aggregate (base-name + size, colors merged), we fetch every approved
  // transaction for the agency, regroup with the exact same keys, and return the
  // ones belonging to this item — so the movements tally with the item's stock
  // IN / OUT / current stock. `displayName` is item.product_name, `itemSize` is
  // item.size (the first-level normalized size).
  async getItemMovementHistory(
    agencyId: string,
    displayName: string,
    itemSize: string
  ): Promise<ExternalInventoryTransaction[]> {
    const PAGE = 1000;
    const all: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('external_inventory_management')
        .select(`
          id, product_name, product_code, color, size, category,
          unit_price, quantity, transaction_date, external_source,
          transaction_type, reference_name, approval_status, user_name, notes
        `)
        .eq('agency_id', agencyId)
        .eq('approval_status', 'approved') // only approved affect stock (matches summary)
        .order('transaction_date', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error('Error fetching product movement history:', error);
        throw error;
      }
      all.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }

    // Map raw product_name -> products.name (display) exactly like the builder.
    const uniqueNames = [...new Set(all.map((t) => t.product_name))];
    const displayByDesc = new Map<string, string>();
    if (uniqueNames.length > 0) {
      const { data: prods } = await supabase
        .from('products')
        .select('description, name')
        .in('description', uniqueNames);
      prods?.forEach((p: any) => { if (p.description) displayByDesc.set(p.description, p.name); });
    }

    const targetKey = _itemGroupKey(displayName, itemSize);

    return all.filter((t) => {
      const dn = displayByDesc.get(t.product_name) || t.product_name;
      const firstLevelSize = _extractFirstLevelSize(t.product_name, t.size);
      return _itemGroupKey(dn, firstLevelSize) === targetKey;
    }) as any;
  }

  // Get stock breakdown by transaction type
  async getStockByType(agencyId: string): Promise<ExternalInventoryByType[]> {
    const { data, error } = await supabase
      .from('external_inventory_by_type')
      .select('*')
      .eq('agency_id', agencyId)
      .order('product_name', { ascending: true });

    if (error) {
      console.error('Error fetching external inventory by type:', error);
      throw error;
    }

    return data || [];
  }

  // Get current stock for a specific product (only approved transactions).
  // NOTE: this matches product_name/color/size exactly, so it does NOT see rows
  // recorded with 'Default' color/size (stock counts, Odoo syncs) or names with
  // packaging suffixes — its number can differ from the Inventory screen. For
  // anything user-facing use buildStockLookup + lookupProductStock instead.
  async getCurrentStock(
    agencyId: string, 
    productName: string, 
    color: string = 'Default', 
    size: string = 'Default'
  ): Promise<number> {
    const { data, error } = await supabase
      .from('external_inventory_management')
      .select('quantity')
      .eq('agency_id', agencyId)
      .eq('product_name', productName)
      .eq('color', color)
      .eq('size', size)
      .eq('approval_status', 'approved'); // Only approved transactions

    if (error) {
      console.error('Error getting current stock:', error);
      return 0;
    }

    const totalStock = data?.reduce((sum, row) => sum + row.quantity, 0) || 0;
    return totalStock;
  }

  // Calculate inventory metrics for user
  async getInventoryMetrics(userId: string): Promise<ExternalInventoryMetrics> {
    const stockSummary = await this.getStockSummary(userId);
    
    const totalItems = stockSummary.length;
    const totalValue = stockSummary.reduce((sum, item) => 
      sum + (item.current_stock * (item.avg_unit_price || 0)), 0
    );
    const lowStockItems = stockSummary.filter(item => 
      item.current_stock > 0 && item.current_stock <= 5
    ).length;
    const outOfStockItems = stockSummary.filter(item => 
      item.current_stock <= 0
    ).length;
    const totalTransactions = stockSummary.reduce((sum, item) => 
      sum + item.transaction_count, 0
    );

    return {
      totalItems,
      totalValue,
      lowStockItems,
      outOfStockItems,
      totalTransactions
    };
  }

  // Calculate inventory metrics for agency (superuser)
  async getAgencyInventoryMetrics(agencyId: string): Promise<ExternalInventoryMetrics> {
    const stockSummary = await this.getAgencyStockSummary(agencyId);
    
    const totalItems = stockSummary.length;
    const totalValue = stockSummary.reduce((sum, item) => 
      sum + (item.current_stock * (item.avg_unit_price || 0)), 0
    );
    const lowStockItems = stockSummary.filter(item => 
      item.current_stock > 0 && item.current_stock <= 5
    ).length;
    const outOfStockItems = stockSummary.filter(item => 
      item.current_stock <= 0
    ).length;
    const totalTransactions = stockSummary.reduce((sum, item) => 
      sum + item.transaction_count, 0
    );

    return {
      totalItems,
      totalValue,
      lowStockItems,
      outOfStockItems,
      totalTransactions
    };
  }

  // Add stock adjustment with product matching
  async addStockAdjustment(
    agencyId: string,
    userName: string,
    productName: string,
    color: string,
    size: string,
    adjustmentQuantity: number, // Can be positive or negative
    reason: string,
    notes?: string
  ): Promise<void> {
    // Look up category/sub-category from products so adjustments land in correct buckets
    const { data: productMeta } = await supabase
      .from('products')
      .select('category, sub_category')
      .eq('name', productName)
      .maybeSingle();
    
    const { error } = await supabase
      .from('external_inventory_management')
      .insert({
        product_name: productName,
        color: color,
        size: size,
        category: productMeta?.category || 'General',
        sub_category: productMeta?.sub_category || 'General',
        matched_product_id: null,
        transaction_type: 'adjustment',
        transaction_id: `ADJ-${Date.now()}`,
        quantity: adjustmentQuantity,
        reference_name: reason,
        agency_id: agencyId,
        user_name: userName,
        notes: notes || `Manual stock adjustment: ${reason}`,
        external_source: 'manual'
      });

    if (error) {
      console.error('Error adding stock adjustment:', error);
      throw error;
    }
  }

  // Add sale transaction (stock OUT) with product matching
  async addSaleTransaction(
    agencyId: string,
    userName: string,
    productName: string,
    color: string,
    size: string,
    quantity: number,
    customerName: string,
    invoiceNumber?: string,
    unitPrice?: number
  ): Promise<void> {
    console.log('🔄 addSaleTransaction called with:', {
      agencyId,
      userName,
      productName,
      color,
      size,
      quantity,
      customerName,
      invoiceNumber,
      unitPrice
    });
    
    // No product matching needed - but we want to normalize the product_name
    // so it matches the GRN / bot format (usually products.description like "[PC22] PETTY COURT 22")
    // Pull category/sub-category from products table when possible
    const { data: productMeta } = await supabase
      .from('products')
      .select('category, sub_category, description')
      .eq('name', productName)
      .maybeSingle();
    
    // Start from the plain product name that comes from the UI
    let formattedProductName = productName;
    
    // First, try to map products.name -> products.description
    try {
      const { data: productRecord, error: productError } = await supabase
        .from('products')
        .select('description')
        .eq('name', productName)
        .maybeSingle();

      if (!productError && productRecord?.description) {
        formattedProductName = productRecord.description;
        console.log('🔄 Using products.description for sale transaction:', formattedProductName);
      } else {
        // Fallback: Try to match the product name format used by external bot sync
        // External bot uses format like "[BBL] BRITNY-BLACK L"
        const { data: matchingProducts } = await supabase
          .from('external_inventory_management')
          .select('product_name, product_code')
          .ilike('product_name', `%${productName.replace(/\s+/g, '%')}%`)
          .not('product_code', 'is', null)
          .limit(1);
        
        if (matchingProducts && matchingProducts.length > 0) {
          formattedProductName = matchingProducts[0].product_name;
          console.log('🔄 Using existing product name format from external inventory:', formattedProductName);
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to normalize product name for sale transaction, using raw name:', e);
    }
    
    // Use provided color and size so the sale matches the same
    // variant (color/size) buckets as GRN and other stock-in rows.
    // Fallback to 'Default' only when not provided.
    const transactionData = {
      product_name: formattedProductName,
      color: color || 'Default',
      size: size || 'Default',
      unit_price: unitPrice || 0,
      category: productMeta?.category || 'General',
      sub_category: productMeta?.sub_category || 'General',
      matched_product_id: null,
      transaction_type: 'sale',
      transaction_id: invoiceNumber || `SALE-${Date.now()}`,
      quantity: -Math.abs(quantity), // Negative for stock OUT
      reference_name: userName, // Use userName so it appears in user's inventory
      agency_id: agencyId,
      user_name: userName,
      notes: `Sale to ${customerName} (Invoice: ${invoiceNumber})`,
      external_source: 'manual'
    };
    
    console.log('📦 Inserting transaction data:', transactionData);
    
    const { error, data } = await supabase
      .from('external_inventory_management')
      .insert(transactionData)
      .select();

    if (error) {
      console.error('❌ Error adding sale transaction:', error);
      throw error;
    }
    
    console.log('✅ Sale transaction created:', data);
  }

  // Add return transaction (stock IN) with product matching
  async addReturnTransaction(
    agencyId: string,
    userName: string,
    productName: string,
    color: string,
    size: string,
    quantity: number,
    customerName: string,
    reason: string,
    originalInvoiceNumber?: string
  ): Promise<void> {
    // Normalize product name so it matches GRN / bot format (products.description)
    // and pull category info for correct bucketing
    const { data: productMeta } = await supabase
      .from('products')
      .select('category, sub_category, description')
      .eq('name', productName)
      .maybeSingle();

    let formattedProductName = productName;
    try {
      if (productMeta?.description) {
        formattedProductName = productMeta.description;
        console.log('🔄 Using products.description for customer return:', formattedProductName);
      }
    } catch (e) {
      console.warn('⚠️ Failed to normalize product name for customer return, using raw name:', e);
    }
    
    const { error } = await supabase
      .from('external_inventory_management')
      .insert({
        product_name: formattedProductName,
        color: color || 'Default',
        size: size || 'Default',
        category: productMeta?.category || 'General',
        sub_category: productMeta?.sub_category || 'General',
        matched_product_id: null,
        transaction_type: 'customer_return',
        transaction_id: `RET-${Date.now()}`,
        quantity: Math.abs(quantity), // Positive for stock IN
        reference_name: userName, // Use userName so it appears in user's inventory
        agency_id: agencyId,
        user_name: userName,
        notes: `Return from ${customerName}: ${reason}${originalInvoiceNumber ? ` (Original: ${originalInvoiceNumber})` : ''}`,
        external_source: 'manual',
        external_reference: originalInvoiceNumber
      });

    if (error) {
      console.error('Error adding return transaction:', error);
      throw error;
    }
  }

  // Search products by name for user
  async searchProducts(userId: string, searchTerm: string): Promise<ExternalInventoryItem[]> {
    return this.buildStockSummaryFromTransactions(userId, { searchTerm });
  }

  // Get products by category for user
  async getProductsByCategory(userId: string, category: string): Promise<ExternalInventoryItem[]> {
    return this.buildStockSummaryFromTransactions(userId, { category });
  }

  // Get unique subcategories for a user from products table via direct relationship
  async getCategories(userId: string): Promise<string[]> {
    try {
      // First get the user's profile name
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, agency_id')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        console.error('Error getting user profile:', profileError);
        return [];
      }

      const userProfileName = profileData.name;
      const agencyId = profileData.agency_id;

      if (!userProfileName) {
        console.warn('User profile has no name');
        return [];
      }

      // Get unique product names from external inventory where reference_name matches user profile name
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('external_inventory_management')
        .select('product_name')
        .eq('agency_id', agencyId)
        .eq('reference_name', userProfileName);

      if (inventoryError) {
        console.error('Error getting inventory product names:', inventoryError);
        throw inventoryError;
      }

      if (!inventoryData || inventoryData.length === 0) {
        return [];
      }

      const productNames = [...new Set(inventoryData.map(item => item.product_name))];

      // Get subcategories from products table where description matches product names
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('sub_category')
        .in('description', productNames)
        .not('sub_category', 'is', null);

      if (productsError) {
        console.error('Error getting subcategories from products:', productsError);
        throw productsError;
      }

      const categories = [...new Set(productsData?.map(item => item.sub_category).filter(Boolean))];
      return categories.sort();
    } catch (error) {
      console.error('Error in getCategories:', error);
      throw error;
    }
  }

  // Get unique subcategories for an agency (superuser mode) - no reference_name filtering
  async getAgencyCategories(agencyId: string): Promise<string[]> {
    try {
      console.log(`🔍 Debug: Getting categories for agency ${agencyId} (superuser mode)`);

      // Get unique product names from external inventory for the entire agency
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('external_inventory_management')
        .select('product_name')
        .eq('agency_id', agencyId);

      if (inventoryError) {
        console.error('Error getting agency inventory product names:', inventoryError);
        throw inventoryError;
      }

      if (!inventoryData || inventoryData.length === 0) {
        return [];
      }

      const productNames = [...new Set(inventoryData.map(item => item.product_name))];

      // Get subcategories from products table where description matches product names
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('sub_category')
        .in('description', productNames)
        .not('sub_category', 'is', null);

      if (productsError) {
        console.error('Error getting subcategories from products:', productsError);
        throw productsError;
      }

      const categories = [...new Set(productsData?.map(item => item.sub_category).filter(Boolean))];
      return categories.sort();
    } catch (error) {
      console.error('Error in getAgencyCategories:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const externalInventoryService = new ExternalInventoryService();
