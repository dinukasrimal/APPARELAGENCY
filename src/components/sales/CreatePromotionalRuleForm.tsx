
import { useState } from 'react';
import { PromotionalRule } from '@/types/discounts';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Gift, Percent } from 'lucide-react';

interface CreatePromotionalRuleFormProps {
  customers: Customer[];
  products: Product[];
  agents: User[];
  onSubmit: (rule: Omit<PromotionalRule, 'id' | 'createdAt' | 'createdBy' | 'currentUsageCount'>) => void;
  onCancel: () => void;
}

const CreatePromotionalRuleForm = ({ customers, products, agents, onSubmit, onCancel }: CreatePromotionalRuleFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'buy_x_get_y_free' as PromotionalRule['type'],
    buyQuantity: 1,
    getQuantity: 1,
    discountPercentage: 0,
    applicableTo: 'product' as PromotionalRule['applicableTo'],
    buyProductIds: [] as string[],
    getProductIds: [] as string[],
    customerIds: [] as string[],
    agentIds: [] as string[],
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    maxUsageCount: '',
    description: ''
  });

  const handleProductToggle = (productId: string, checked: boolean, type: 'buy' | 'get') => {
    const field = type === 'buy' ? 'buyProductIds' : 'getProductIds';
    if (checked) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], productId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: prev[field].filter(id => id !== productId)
      }));
    }
  };

  const handleCustomerToggle = (customerId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        customerIds: [...prev.customerIds, customerId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        customerIds: prev.customerIds.filter(id => id !== customerId)
      }));
    }
  };

  const handleAgentToggle = (agentId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        agentIds: [...prev.agentIds, agentId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        agentIds: prev.agentIds.filter(id => id !== agentId)
      }));
    }
  };

  const getProductNames = (productIds: string[]) => {
    return productIds.map(id => {
      const product = products.find(p => p.id === id);
      return product ? product.name : '';
    }).filter(Boolean);
  };

  const getCustomerNames = () => {
    return formData.customerIds.map(id => {
      const customer = customers.find(c => c.id === id);
      return customer ? customer.name : '';
    }).filter(Boolean);
  };

  const getAgentNames = () => {
    return formData.agentIds.map(id => {
      const agent = agents.find(a => a.id === id);
      return agent ? agent.name : '';
    }).filter(Boolean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const rule: Omit<PromotionalRule, 'id' | 'createdAt' | 'createdBy' | 'currentUsageCount'> = {
      name: formData.name,
      type: formData.type,
      buyQuantity: formData.buyQuantity,
      getQuantity: formData.getQuantity,
      discountPercentage: formData.type === 'buy_x_get_y_discount' ? formData.discountPercentage : undefined,
      applicableTo: formData.applicableTo,
      buyProductIds: formData.buyProductIds,
      getProductIds: formData.getProductIds,
      buyProductNames: getProductNames(formData.buyProductIds),
      getProductNames: getProductNames(formData.getProductIds),
      customerIds: formData.customerIds.length > 0 ? formData.customerIds : undefined,
      agentIds: formData.agentIds.length > 0 ? formData.agentIds : undefined,
      customerNames: formData.customerIds.length > 0 ? getCustomerNames() : undefined,
      agentNames: formData.agentIds.length > 0 ? getAgentNames() : undefined,
      isActive: formData.isActive,
      validFrom: new Date(formData.validFrom),
      validTo: new Date(formData.validTo),
      maxUsageCount: formData.maxUsageCount ? parseInt(formData.maxUsageCount) : undefined,
      description: formData.description
    };

    onSubmit(rule);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Rules
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">Create Promotional Rule</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promotional Rule Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Summer BOGO Offer"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Promotion Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: PromotionalRule['type']) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy_x_get_y_free">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        Buy X Get Y Free
                      </div>
                    </SelectItem>
                    <SelectItem value="buy_x_get_y_discount">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Buy X Get Y Discounted
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="buyQuantity">Buy Quantity (X)</Label>
                <Input
                  id="buyQuantity"
                  type="number"
                  value={formData.buyQuantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, buyQuantity: parseInt(e.target.value) || 1 }))}
                  min="1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="getQuantity">Get Quantity (Y)</Label>
                <Input
                  id="getQuantity"
                  type="number"
                  value={formData.getQuantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, getQuantity: parseInt(e.target.value) || 1 }))}
                  min="1"
                  required
                />
              </div>

              {formData.type === 'buy_x_get_y_discount' && (
                <div>
                  <Label htmlFor="discountPercentage">Discount Percentage on Y items</Label>
                  <Input
                    id="discountPercentage"
                    type="number"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountPercentage: parseFloat(e.target.value) || 0 }))}
                    placeholder="50"
                    min="0"
                    max="100"
                    required
                  />
                </div>
              )}

              <div>
                <Label htmlFor="validFrom">Valid From</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="validTo">Valid Until</Label>
                <Input
                  id="validTo"
                  type="date"
                  value={formData.validTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, validTo: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="maxUsageCount">Max Usage Count (Optional)</Label>
                <Input
                  id="maxUsageCount"
                  type="number"
                  value={formData.maxUsageCount}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxUsageCount: e.target.value }))}
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked as boolean }))}
                />
                <Label htmlFor="isActive">Activate rule immediately</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe this promotional offer..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Select Products to Buy (X)</Label>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  <div className="space-y-2">
                    {products.map((product) => (
                      <div key={product.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`buy-${product.id}`}
                          checked={formData.buyProductIds.includes(product.id)}
                          onCheckedChange={(checked) => handleProductToggle(product.id, checked as boolean, 'buy')}
                        />
                        <Label htmlFor={`buy-${product.id}`} className="text-sm font-normal">
                          {product.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label>Select Products to Get (Y)</Label>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  <div className="space-y-2">
                    {products.map((product) => (
                      <div key={product.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`get-${product.id}`}
                          checked={formData.getProductIds.includes(product.id)}
                          onCheckedChange={(checked) => handleProductToggle(product.id, checked as boolean, 'get')}
                        />
                        <Label htmlFor={`get-${product.id}`} className="text-sm font-normal">
                          {product.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Restrict to Specific Customers (Optional)</Label>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  <div className="space-y-2">
                    {customers.map((customer) => (
                      <div key={customer.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`customer-${customer.id}`}
                          checked={formData.customerIds.includes(customer.id)}
                          onCheckedChange={(checked) => handleCustomerToggle(customer.id, checked as boolean)}
                        />
                        <Label htmlFor={`customer-${customer.id}`} className="text-sm font-normal">
                          {customer.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label>Restrict to Specific Agents (Optional)</Label>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  <div className="space-y-2">
                    {agents.filter(agent => agent.role === 'agent').map((agent) => (
                      <div key={agent.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`agent-${agent.id}`}
                          checked={formData.agentIds.includes(agent.id)}
                          onCheckedChange={(checked) => handleAgentToggle(agent.id, checked as boolean)}
                        />
                        <Label htmlFor={`agent-${agent.id}`} className="text-sm font-normal">
                          {agent.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Create Promotional Rule
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreatePromotionalRuleForm;
