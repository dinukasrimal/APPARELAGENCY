import { useState } from 'react';
import { DiscountRule } from '@/types/discounts';
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
import { ArrowLeft, Users, Package, UserCheck, Globe } from 'lucide-react';

interface CreateDiscountRuleFormProps {
  customers: Customer[];
  products: Product[];
  agents: User[];
  onSubmit: (rule: Omit<DiscountRule, 'id' | 'createdAt' | 'createdBy' | 'currentUsageCount'>) => void;
  onCancel: () => void;
}

const CreateDiscountRuleForm = ({ customers, products, agents, onSubmit, onCancel }: CreateDiscountRuleFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'percentage' as DiscountRule['type'],
    value: 0,
    applicableTo: 'global' as DiscountRule['applicableTo'],
    targetIds: [] as string[],
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    maxUsageCount: '',
    description: ''
  });

  const handleTargetToggle = (id: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        targetIds: [...prev.targetIds, id]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        targetIds: prev.targetIds.filter(targetId => targetId !== id)
      }));
    }
  };

  const getTargetOptions = () => {
    switch (formData.applicableTo) {
      case 'customer':
        return customers;
      case 'product':
        return products;
      case 'agent':
        return agents.filter(agent => agent.role === 'agent');
      default:
        return [];
    }
  };

  const getTargetNames = () => {
    const options = getTargetOptions();
    return formData.targetIds.map(id => {
      const item = options.find(option => option.id === id);
      return item ? item.name : '';
    }).filter(Boolean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const rule: Omit<DiscountRule, 'id' | 'createdAt' | 'createdBy' | 'currentUsageCount'> = {
      name: formData.name,
      type: formData.type,
      value: formData.value,
      applicableTo: formData.applicableTo,
      targetIds: formData.applicableTo === 'global' ? [] : formData.targetIds,
      targetNames: formData.applicableTo === 'global' ? [] : getTargetNames(),
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
        <h2 className="text-2xl font-bold text-gray-900">Create Discount Rule</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discount Rule Details</CardTitle>
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
                  placeholder="e.g., VIP Customer Discount"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Discount Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: DiscountRule['type']) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Discount</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount Discount</SelectItem>
                    <SelectItem value="special_pricing">Special Pricing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="value">
                  {formData.type === 'percentage' ? 'Discount Percentage' : 'Discount Amount (LKR)'}
                </Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                  placeholder={formData.type === 'percentage' ? '10' : '100'}
                  required
                  min="0"
                  max={formData.type === 'percentage' ? "100" : undefined}
                />
              </div>

              <div>
                <Label htmlFor="applicableTo">Apply To</Label>
                <Select
                  value={formData.applicableTo}
                  onValueChange={(value: DiscountRule['applicableTo']) => 
                    setFormData(prev => ({ ...prev, applicableTo: value, targetIds: [] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        All Customers (Global)
                      </div>
                    </SelectItem>
                    <SelectItem value="customer">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Specific Customers
                      </div>
                    </SelectItem>
                    <SelectItem value="product">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Specific Products
                      </div>
                    </SelectItem>
                    <SelectItem value="agent">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Specific Agents
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                placeholder="Describe when and how this discount should be applied..."
                rows={3}
              />
            </div>

            {formData.applicableTo !== 'global' && (
              <div>
                <Label>Select {formData.applicableTo === 'customer' ? 'Customers' : formData.applicableTo === 'product' ? 'Products' : 'Agents'}</Label>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  <div className="space-y-2">
                    {getTargetOptions().map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.id}
                          checked={formData.targetIds.includes(item.id)}
                          onCheckedChange={(checked) => handleTargetToggle(item.id, checked as boolean)}
                        />
                        <Label htmlFor={item.id} className="text-sm font-normal">
                          {item.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-6">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Create Discount Rule
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateDiscountRuleForm;
