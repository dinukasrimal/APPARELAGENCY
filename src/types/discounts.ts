
export interface DiscountRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed_amount' | 'special_pricing';
  value: number; // percentage or fixed amount
  applicableTo: 'customer' | 'product' | 'agent' | 'global';
  targetIds: string[]; // customer IDs, product IDs, or agent IDs
  targetNames: string[]; // for display purposes
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
  maxUsageCount?: number;
  currentUsageCount: number;
  description?: string;
  createdAt: Date;
  createdBy: string;
}

export interface PromotionalRule {
  id: string;
  name: string;
  type: 'buy_x_get_y_free' | 'buy_x_get_y_discount' | 'bundle_discount';
  buyQuantity: number; // X quantity to buy
  getQuantity: number; // Y quantity to get
  discountPercentage?: number; // for percentage discounts on Y items
  applicableTo: 'product' | 'category' | 'global';
  buyProductIds: string[]; // products that need to be bought
  getProductIds: string[]; // products that will be free/discounted
  buyProductNames: string[];
  getProductNames: string[];
  customerIds?: string[]; // specific customers, empty for all
  agentIds?: string[]; // specific agents, empty for all
  customerNames?: string[];
  agentNames?: string[];
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
  maxUsageCount?: number;
  currentUsageCount: number;
  description?: string;
  createdAt: Date;
  createdBy: string;
}

export interface RuleApplication {
  orderId: string;
  ruleId: string;
  ruleType: 'discount' | 'promotional';
  appliedAmount: number;
  appliedAt: Date;
}
