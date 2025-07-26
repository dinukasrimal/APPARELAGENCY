
import { GRNItem } from '@/types/grn';
import { Product } from '@/types/product';

export interface ParsedInvoiceData {
  invoiceNumber?: string;
  date?: string;
  items: GRNItem[];
  total?: number;
}

export class InvoiceParser {
  private static productMaster: Product[] = [];

  // Set product master data for reference
  static setProductMaster(products: Product[]) {
    this.productMaster = products;
    console.log('InvoiceParser: Product master set with', products.length, 'products');
  }

  // Enhanced product matching - case insensitive, exact text match
  static findProductMatch(productText: string): Product | null {
    if (!productText || this.productMaster.length === 0) return null;
    
    const normalizedText = productText.trim().toLowerCase();
    
    // First try exact match
    const exactMatch = this.productMaster.find(product => 
      product.name.toLowerCase() === normalizedText
    );
    
    if (exactMatch) {
      console.log('InvoiceParser: Found exact product match:', exactMatch.name);
      return exactMatch;
    }
    
    // Then try contains match
    const containsMatch = this.productMaster.find(product => 
      product.name.toLowerCase().includes(normalizedText) || 
      normalizedText.includes(product.name.toLowerCase())
    );
    
    if (containsMatch) {
      console.log('InvoiceParser: Found partial product match:', containsMatch.name);
      return containsMatch;
    }
    
    return null;
  }

  static parseOCRText(text: string): ParsedInvoiceData {
    console.log('InvoiceParser: Starting OCR parsing with specific invoice format matching');
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const result: ParsedInvoiceData = {
      items: []
    };

    // Extract invoice number
    const invoiceMatch = text.match(/invoice\s+(?:no|number|#|INV)[:\s\/]*([A-Z0-9\/\-]+)/i);
    if (invoiceMatch) {
      result.invoiceNumber = invoiceMatch[1];
      console.log('InvoiceParser: Found invoice number:', result.invoiceNumber);
    }

    // Extract date
    const dateMatch = text.match(/date[:\s]*(\d{4}\/\d{2}\/\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/i);
    if (dateMatch) {
      result.date = dateMatch[1];
      console.log('InvoiceParser: Found date:', result.date);
    }

    // Parse items using the specific invoice format
    this.parseInvoiceFormatItems(text, result);

    // Extract total amount
    const totalMatch = text.match(/(?:total|grand\s*total|amount)[:\s]*(?:LKR|Rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (totalMatch) {
      result.total = parseFloat(totalMatch[1].replace(/,/g, ''));
      console.log('InvoiceParser: Found total:', result.total);
    }

    console.log('InvoiceParser: Successfully parsed', result.items.length, 'items');
    return result;
  }

  private static parseInvoiceFormatItems(text: string, result: ParsedInvoiceData) {
    const lines = text.split('\n').map(line => line.trim());
    let itemId = 1;
    
    // Look for the specific pattern in the invoice format
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip headers and non-product lines
      if (this.isHeaderOrTotalLine(line)) continue;
      
      // Look for product line pattern: [CODE] PRODUCT-NAME SIZE
      const productMatch = line.match(/^\[([^\]]+)\]\s+(.+?)(?:\s+(\w+))?$/);
      
      if (productMatch) {
        const [, productCode, productName, size] = productMatch;
        const fullProductText = `[${productCode}] ${productName.trim()}`;
        
        // Try to find the next line with quantities and prices
        const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
        
        // Parse quantity and price from next line or same line
        const quantityPriceMatch = this.extractQuantityAndPrice(nextLine || line);
        
        if (quantityPriceMatch) {
          const { quantity, unitPrice, discountPercentage } = quantityPriceMatch;
          
          // Try to find product match
          const matchedProduct = this.findProductMatch(fullProductText) || 
                                this.findProductMatch(productCode) || 
                                this.findProductMatch(productName.trim());
          
          if (matchedProduct) {
            // Calculate total amount
            const calculatedAmount = quantity * unitPrice;
            
            console.log(`InvoiceParser: Matched product - ${matchedProduct.name}, Qty: ${quantity}, Price: ${unitPrice}, Amount: ${calculatedAmount}`);
            
            const item: GRNItem = {
              id: itemId.toString(),
              productName: matchedProduct.name,
              color: 'Not specified',
              size: size || 'Not specified',
              quantity: quantity,
              unitPrice: unitPrice,
              discountPercentage: discountPercentage || 0,
              total: calculatedAmount
            };
            
            result.items.push(item);
            itemId++;
          } else {
            console.log(`InvoiceParser: No product match found for: ${fullProductText}`);
          }
        }
      }
    }
  }

  private static extractQuantityAndPrice(line: string): {
    quantity: number;
    unitPrice: number;
    discountPercentage?: number;
  } | null {
    
    // Pattern for: "11.00 Units 658.60 13.00 6,302.80 Rs"
    const pattern = /(\d+(?:\.\d+)?)\s+Units?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+[\d,]+\.?\d*\s*Rs?/i;
    const match = line.match(pattern);
    
    if (match) {
      const quantity = parseFloat(match[1]);
      const unitPrice = parseFloat(match[2]);
      const discountPercentage = parseFloat(match[3]);
      
      console.log(`InvoiceParser: Extracted - Qty: ${quantity}, Price: ${unitPrice}, Discount: ${discountPercentage}%`);
      
      return {
        quantity,
        unitPrice,
        discountPercentage
      };
    }
    
    // Fallback pattern for simpler formats
    const simplePattern = /(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/;
    const simpleMatch = line.match(simplePattern);
    
    if (simpleMatch) {
      const quantity = parseFloat(simpleMatch[1]);
      const unitPrice = parseFloat(simpleMatch[2]);
      
      console.log(`InvoiceParser: Extracted (simple) - Qty: ${quantity}, Price: ${unitPrice}`);
      
      return {
        quantity,
        unitPrice,
        discountPercentage: 0
      };
    }
    
    return null;
  }

  private static isHeaderOrTotalLine(line: string): boolean {
    const lowerLine = line.toLowerCase();
    return /(?:total|subtotal|grand\s*total|description|product|item|quantity|price|amount|discount|invoice|date|due\s*date|source|tax\s*invoice|page|unit\s*price|disc\.?%|taxes)/i.test(lowerLine);
  }
}
