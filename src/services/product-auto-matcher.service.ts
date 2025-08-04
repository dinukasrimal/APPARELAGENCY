import { supabase } from '@/integrations/supabase/client';

export class ProductAutoMatcherService {
  
  // Auto-match unmatched products and create missing master products
  async autoMatchUnmatchedProducts(agencyId: string): Promise<{
    matched: number;
    created: number;
    failed: number;
  }> {
    let matchedCount = 0;
    let createdCount = 0;
    let failedCount = 0;

    try {
      // Get all unmatched external inventory items
      const { data: unmatchedItems, error: fetchError } = await supabase
        .from('external_inventory_management')
        .select('id, product_name, product_code, color, size, category, sub_category')
        .eq('agency_id', agencyId)
        .is('matched_product_id', null);

      if (fetchError) throw fetchError;

      if (!unmatchedItems || unmatchedItems.length === 0) {
        return { matched: 0, created: 0, failed: 0 };
      }

      // Group unmatched items by base product name
      const productGroups = this.groupByBaseProduct(unmatchedItems);

      for (const [baseProductName, items] of productGroups.entries()) {
        try {
          // Try to find existing master product
          let masterProduct = await this.findMasterProduct(baseProductName, agencyId);

          // If no master product exists, create one
          if (!masterProduct) {
            masterProduct = await this.createMasterProduct(baseProductName, items[0], agencyId);
            if (masterProduct) {
              createdCount++;
            } else {
              failedCount += items.length;
              continue;
            }
          }

          // Link all variants of this product to the master product
          for (const item of items) {
            const success = await this.linkToMasterProduct(item.id, masterProduct.id);
            if (success) {
              matchedCount++;
            } else {
              failedCount++;
            }
          }
        } catch (error) {
          console.error(`Error processing product group ${baseProductName}:`, error);
          failedCount += items.length;
        }
      }

      return { matched: matchedCount, created: createdCount, failed: failedCount };
    } catch (error) {
      console.error('Error in auto-matching process:', error);
      throw error;
    }
  }

  // Group items by base product name (remove size/color variations)
  private groupByBaseProduct(items: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    items.forEach(item => {
      const baseProductName = this.extractBaseProductName(item.product_name);
      
      if (!groups.has(baseProductName)) {
        groups.set(baseProductName, []);
      }
      groups.get(baseProductName)!.push(item);
    });

    return groups;
  }

  // Extract base product name (remove size, color, brackets)
  private extractBaseProductName(productName: string): string {
    // Remove product code in brackets
    let baseName = productName.replace(/^\[[^\]]+\]\s*/, '');
    
    // Remove color and size patterns
    baseName = baseName.replace(/-[A-Z]+\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i, '');
    baseName = baseName.replace(/\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i, '');
    baseName = baseName.replace(/-[A-Z]+$/i, '');
    
    return baseName.trim();
  }

  // Find existing master product
  private async findMasterProduct(baseProductName: string, agencyId: string): Promise<any | null> {
    // Try exact match first
    let { data, error } = await supabase
      .from('products')
      .select('id, name, category, sub_category')
      .eq('agency_id', agencyId)
      .ilike('name', baseProductName)
      .limit(1);

    if (!error && data && data.length > 0) {
      return data[0];
    }

    // Try fuzzy match
    ({ data, error } = await supabase
      .from('products')
      .select('id, name, category, sub_category')
      .eq('agency_id', agencyId)
      .ilike('name', `%${baseProductName}%`)
      .limit(1));

    if (!error && data && data.length > 0) {
      return data[0];
    }

    return null;
  }

  // Create a new master product
  private async createMasterProduct(baseProductName: string, sampleItem: any, agencyId: string): Promise<any | null> {
    try {
      // Extract product code if available
      const productCode = sampleItem.product_code || this.extractProductCode(sampleItem.product_name);
      
      // Determine category based on product code or name
      const category = this.determineCategory(productCode, baseProductName, sampleItem.category);

      // Create basic color and size arrays (will be expanded as more variants are found)
      const colors = sampleItem.color && sampleItem.color !== 'Default' ? [sampleItem.color] : ['Default'];
      const sizes = sampleItem.size && sampleItem.size !== 'Default' ? [sampleItem.size] : ['Default'];

      const { data, error } = await supabase
        .from('products')
        .insert({
          name: baseProductName,
          category: category,
          sub_category: sampleItem.sub_category || 'General',
          colors: colors,
          sizes: sizes,
          selling_price: 0, // Will be updated later
          billing_price: 0,
          agency_id: agencyId,
          description: `Auto-created from external inventory: ${sampleItem.product_name}`
        })
        .select('id, name, category, sub_category')
        .single();

      if (error) {
        console.error('Error creating master product:', error);
        return null;
      }

      console.log(`✅ Created master product: ${baseProductName} (ID: ${data.id})`);
      return data;
    } catch (error) {
      console.error('Error in createMasterProduct:', error);
      return null;
    }
  }

  // Extract product code from product name
  private extractProductCode(productName: string): string | null {
    const codeMatch = productName.match(/\[([^\]]+)\]/);
    return codeMatch ? codeMatch[1] : null;
  }

  // Determine category based on product code and name
  private determineCategory(productCode: string | null, productName: string, existingCategory?: string): string {
    if (existingCategory && existingCategory !== 'General') {
      return existingCategory;
    }

    const code = productCode?.toUpperCase() || '';
    const name = productName.toUpperCase();

    // Category rules based on product codes
    if (code.startsWith('SB') || code.startsWith('SBE') || name.includes('SOLACE')) {
      return 'SOLACE';
    }
    if (code.startsWith('BB') || name.includes('BRITNY')) {
      return 'BRITNY';
    }
    if (code.startsWith('CV') || name.includes('COLOR VEST') || name.includes('VEST')) {
      return 'COLOR_VEST';
    }
    if (code.startsWith('SW') || name.includes('SHORTS')) {
      return 'SHORTS';
    }
    if (code.startsWith('BW') || code.startsWith('BWS')) {
      return 'BW_SERIES';
    }

    return 'General';
  }

  // Link external inventory item to master product
  private async linkToMasterProduct(externalItemId: string, masterProductId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('external_inventory_management')
        .update({ matched_product_id: masterProductId })
        .eq('id', externalItemId);

      if (error) {
        console.error('Error linking to master product:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in linkToMasterProduct:', error);
      return false;
    }
  }

  // Get unmatched products summary
  async getUnmatchedSummary(agencyId: string): Promise<{
    totalUnmatched: number;
    unmatchedByCategory: { [key: string]: number };
    sampleUnmatched: any[];
  }> {
    const { data, error } = await supabase
      .from('external_inventory_management')
      .select('product_name, category, sub_category')
      .eq('agency_id', agencyId)
      .is('matched_product_id', null);

    if (error) throw error;

    const totalUnmatched = data?.length || 0;
    const unmatchedByCategory: { [key: string]: number } = {};
    
    data?.forEach(item => {
      const category = item.category || 'General';
      unmatchedByCategory[category] = (unmatchedByCategory[category] || 0) + 1;
    });

    const sampleUnmatched = data?.slice(0, 10) || [];

    return {
      totalUnmatched,
      unmatchedByCategory,
      sampleUnmatched
    };
  }
}

// Create singleton instance
export const productAutoMatcherService = new ProductAutoMatcherService();