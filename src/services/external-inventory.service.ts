// External inventory service for processing external invoices as stock IN
import { supabase } from '@/integrations/supabase/client';
import { ExternalDataService } from './external-data.service';
import { User } from '@/types/auth';

export interface ExternalProductMatch {
  externalProductName: string;
  externalCategory: string;
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchedColor: string | null;
  matchedSize: string | null;
  matchConfidence: number; // 0-100 confidence score
}

export interface ExternalInventoryTransaction {
  externalInvoiceId: string;
  externalProductName: string;
  externalProductCategory: string;
  quantity: number;
  priceUnit: number;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedColor?: string;
  matchedSize?: string;
  agencyId: string;
  userId: string;
}

export class ExternalInventoryService {
  private static instance: ExternalInventoryService;

  public static getInstance(): ExternalInventoryService {
    if (!ExternalInventoryService.instance) {
      ExternalInventoryService.instance = new ExternalInventoryService();
    }
    return ExternalInventoryService.instance;
  }

  private constructor() {}

  /**
   * Match external product name to internal product catalog
   */
  private async matchExternalProduct(
    externalProductName: string,
    externalCategory: string
  ): Promise<ExternalProductMatch> {
    try {
      console.log('🔍 Matching external product:', externalProductName, 'category:', externalCategory);
      
      // Get all products from internal catalog
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          category,
          colors,
          sizes
        `);

      if (error || !products) {
        console.error('Error fetching products for matching:', error);
        return {
          externalProductName,
          externalCategory,
          matchedProductId: null,
          matchedProductName: null,
          matchedColor: null,
          matchedSize: null,
          matchConfidence: 0
        };
      }

      let bestMatch: ExternalProductMatch | null = null;
      let highestScore = 0;

      // Normalize external product name for matching
      const normalizedExternal = externalProductName.toLowerCase().trim();
      const normalizedCategory = externalCategory.toLowerCase().trim();

      for (const product of products) {
        const normalizedInternal = product.name.toLowerCase().trim();
        const normalizedInternalCategory = product.category.toLowerCase().trim();
        
        let score = 0;

        // Category matching (30% weight)
        if (normalizedInternalCategory.includes(normalizedCategory) || 
            normalizedCategory.includes(normalizedInternalCategory)) {
          score += 30;
        }

        // Product name matching (50% weight)
        if (normalizedInternal === normalizedExternal) {
          score += 50; // Exact match
        } else if (normalizedInternal.includes(normalizedExternal) || 
                   normalizedExternal.includes(normalizedInternal)) {
          score += 35; // Partial match
        } else {
          // Check for word-level matches
          const externalWords = normalizedExternal.split(/[\s\-_]+/);
          const internalWords = normalizedInternal.split(/[\s\-_]+/);
          
          const commonWords = externalWords.filter(word => 
            word.length > 2 && internalWords.some(iWord => 
              iWord.includes(word) || word.includes(iWord)
            )
          );
          
          if (commonWords.length > 0) {
            score += Math.min(25, commonWords.length * 8);
          }
        }

        // Extract size and color from external product name
        let extractedColor = null;
        let extractedSize = null;

        // Try to extract color (20% weight if found)
        if (product.colors && Array.isArray(product.colors)) {
          for (const color of product.colors) {
            if (normalizedExternal.includes(color.toLowerCase())) {
              extractedColor = color;
              score += 10;
              break;
            }
          }
        }

        // Try to extract size (10% weight if found)
        if (product.sizes && Array.isArray(product.sizes)) {
          for (const size of product.sizes) {
            if (normalizedExternal.includes(size.toLowerCase())) {
              extractedSize = size;
              score += 5;
              break;
            }
          }
        }

        if (score > highestScore && score >= 30) { // Minimum 30% confidence
          highestScore = score;
          bestMatch = {
            externalProductName,
            externalCategory,
            matchedProductId: product.id,
            matchedProductName: product.name,
            matchedColor: extractedColor || (product.colors?.[0] || 'Default'),
            matchedSize: extractedSize || (product.sizes?.[0] || 'Default'),
            matchConfidence: score
          };
        }
      }

      if (bestMatch) {
        console.log(`✅ Found match for "${externalProductName}": ${bestMatch.matchedProductName} (${bestMatch.matchConfidence}% confidence)`);
        return bestMatch;
      } else {
        console.log(`❌ No suitable match found for "${externalProductName}"`);
        return {
          externalProductName,
          externalCategory,
          matchedProductId: null,
          matchedProductName: null,
          matchedColor: null,
          matchedSize: null,
          matchConfidence: 0
        };
      }
    } catch (error) {
      console.error('Error in product matching:', error);
      return {
        externalProductName,
        externalCategory,
        matchedProductId: null,
        matchedProductName: null,
        matchedColor: null,
        matchedSize: null,
        matchConfidence: 0
      };
    }
  }

  /**
   * Process external invoices and create inventory transactions
   */
  public async processExternalInvoicesForInventory(
    user: User,
    userName: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    processedTransactions: number;
    skippedTransactions: number;
    matchedProducts: number;
    unmatchedProducts: number;
    errors: string[];
  }> {
    const result = {
      processedTransactions: 0,
      skippedTransactions: 0,
      matchedProducts: 0,
      unmatchedProducts: 0,
      errors: []
    };

    try {
      console.log('📦 Processing external invoices for inventory - User:', userName);

      // Get external invoices
      const externalDataService = ExternalDataService.getInstance();
      const { data: externalInvoices, error: externalError } = await externalDataService.getInvoices({
        userName,
        startDate,
        endDate
      });

      if (externalError) {
        result.errors.push(`Error fetching external invoices: ${externalError}`);
        return result;
      }

      if (!externalInvoices || externalInvoices.length === 0) {
        console.log('📦 No external invoices found for processing');
        return result;
      }

      console.log(`📦 Found ${externalInvoices.length} external invoices to process`);

      // Process each external invoice
      for (const invoice of externalInvoices) {
        try {
          // Check if this invoice has already been processed
          const { data: existingTransactions } = await supabase
            .from('inventory_transactions')
            .select('id')
            .eq('transaction_type', 'external_invoice')
            .eq('external_invoice_id', invoice.id)
            .limit(1);

          if (existingTransactions && existingTransactions.length > 0) {
            console.log(`📦 Skipping already processed invoice: ${invoice.id}`);
            result.skippedTransactions++;
            continue;
          }

          // Parse order_lines
          let orderLines = invoice.order_lines;
          if (typeof orderLines === 'string') {
            orderLines = JSON.parse(orderLines);
          }

          if (!Array.isArray(orderLines)) {
            console.warn(`📦 Invalid order_lines format for invoice ${invoice.id}`);
            result.errors.push(`Invalid order_lines format for invoice ${invoice.id}`);
            continue;
          }

          // Process each line item
          for (const line of orderLines) {
            if (!line.product_category || !line.qty_delivered || !line.price_unit) {
              console.warn(`📦 Incomplete line item data for invoice ${invoice.id}:`, line);
              continue;
            }

            // Match external product to internal catalog
            const match = await this.matchExternalProduct(
              line.product_name || line.product_category,
              line.product_category
            );

            if (match.matchedProductId) {
              // Create inventory transaction for matched product
              const { error: transactionError } = await supabase
                .from('inventory_transactions')
                .insert({
                  product_id: match.matchedProductId,
                  product_name: match.matchedProductName,
                  color: match.matchedColor,
                  size: match.matchedSize,
                  transaction_type: 'external_invoice',
                  quantity: Number(line.qty_delivered), // Positive for stock IN
                  reference_id: invoice.id,
                  reference_name: `External Invoice ${invoice.id}`,
                  user_id: user.id,
                  agency_id: user.agencyId,
                  external_product_name: line.product_name || line.product_category,
                  external_product_category: line.product_category,
                  external_invoice_id: invoice.id,
                  notes: `Auto-imported from external invoice. Confidence: ${match.matchConfidence}%`
                });

              if (transactionError) {
                console.error('Error creating inventory transaction:', transactionError);
                result.errors.push(`Error creating transaction for ${line.product_name}: ${transactionError.message}`);
              } else {
                result.processedTransactions++;
                result.matchedProducts++;
                console.log(`📦 ✅ Created inventory transaction for ${match.matchedProductName} (${line.qty_delivered} units)`);
              }
            } else {
              result.unmatchedProducts++;
              console.log(`📦 ❌ Could not match product: ${line.product_name || line.product_category} (category: ${line.product_category})`);
              
              // Optionally log unmatched products for manual review
              result.errors.push(`Unmatched product: ${line.product_name || line.product_category} (category: ${line.product_category})`);
            }
          }
        } catch (invoiceError) {
          console.error(`Error processing invoice ${invoice.id}:`, invoiceError);
          result.errors.push(`Error processing invoice ${invoice.id}: ${invoiceError instanceof Error ? invoiceError.message : 'Unknown error'}`);
        }
      }

      console.log('📦 External invoice processing complete:', result);
      return result;

    } catch (error) {
      console.error('Error in processExternalInvoicesForInventory:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Get unmatched external products for manual review
   */
  public async getUnmatchedExternalProducts(
    userName: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    unmatchedProducts: Array<{
      productName: string;
      productCategory: string;
      count: number;
      totalQuantity: number;
    }>;
    error: string | null;
  }> {
    try {
      const externalDataService = ExternalDataService.getInstance();
      const { data: externalInvoices, error: externalError } = await externalDataService.getInvoices({
        userName,
        startDate,
        endDate
      });

      if (externalError) {
        return {
          unmatchedProducts: [],
          error: externalError
        };
      }

      const productStats = new Map();

      for (const invoice of externalInvoices || []) {
        let orderLines = invoice.order_lines;
        if (typeof orderLines === 'string') {
          orderLines = JSON.parse(orderLines);
        }

        if (Array.isArray(orderLines)) {
          for (const line of orderLines) {
            if (line.product_category && line.qty_delivered) {
              const key = `${line.product_name || line.product_category}|${line.product_category}`;
              const existing = productStats.get(key) || {
                productName: line.product_name || line.product_category,
                productCategory: line.product_category,
                count: 0,
                totalQuantity: 0
              };
              
              existing.count++;
              existing.totalQuantity += Number(line.qty_delivered);
              productStats.set(key, existing);
            }
          }
        }
      }

      // Filter out products that have been successfully matched
      const unmatchedProducts = [];
      for (const [, stats] of productStats) {
        const match = await this.matchExternalProduct(stats.productName, stats.productCategory);
        if (match.matchConfidence < 30) { // Consider unmatched if confidence < 30%
          unmatchedProducts.push(stats);
        }
      }

      return {
        unmatchedProducts: unmatchedProducts.sort((a, b) => b.totalQuantity - a.totalQuantity),
        error: null
      };
    } catch (error) {
      return {
        unmatchedProducts: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const externalInventoryService = ExternalInventoryService.getInstance();