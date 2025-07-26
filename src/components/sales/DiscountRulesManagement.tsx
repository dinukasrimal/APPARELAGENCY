import { useState } from 'react';
import { User } from '@/types/auth';
import { DiscountRule, PromotionalRule } from '@/types/discounts';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Users, Package, UserCheck, Globe, Calendar, Gift, Percent } from 'lucide-react';
import CreateDiscountRuleForm from './CreateDiscountRuleForm';
import CreatePromotionalRuleForm from './CreatePromotionalRuleForm';

interface DiscountRulesManagementProps {
  user: User;
  discountRules: DiscountRule[];
  promotionalRules: PromotionalRule[];
  customers: Customer[];
  products: Product[];
  agents: User[];
  onCreateDiscountRule: (rule: Omit<DiscountRule, 'id' | 'createdAt' | 'createdBy' | 'currentUsageCount'>) => void;
  onCreatePromotionalRule: (rule: Omit<PromotionalRule, 'id' | 'createdAt' | 'createdBy' | 'currentUsageCount'>) => void;
  onUpdateDiscountRule: (id: string, updates: Partial<DiscountRule>) => void;
  onUpdatePromotionalRule: (id: string, updates: Partial<PromotionalRule>) => void;
  onDeleteDiscountRule: (id: string) => void;
  onDeletePromotionalRule: (id: string) => void;
}

const DiscountRulesManagement = ({
  user,
  discountRules,
  promotionalRules,
  customers,
  products,
  agents,
  onCreateDiscountRule,
  onCreatePromotionalRule,
  onUpdateDiscountRule,
  onUpdatePromotionalRule,
  onDeleteDiscountRule,
  onDeletePromotionalRule
}: DiscountRulesManagementProps) => {
  const [showCreateDiscountForm, setShowCreateDiscountForm] = useState(false);
  const [showCreatePromotionalForm, setShowCreatePromotionalForm] = useState(false);
  const [editingDiscountRule, setEditingDiscountRule] = useState<DiscountRule | null>(null);
  const [editingPromotionalRule, setEditingPromotionalRule] = useState<PromotionalRule | null>(null);

  if (user.role !== 'superuser') {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-600">Only superusers can manage discount and promotional rules.</p>
      </div>
    );
  }

  const getApplicableToIcon = (applicableTo: string) => {
    switch (applicableTo) {
      case 'customer': return <Users className="h-4 w-4" />;
      case 'product': return <Package className="h-4 w-4" />;
      case 'agent': return <UserCheck className="h-4 w-4" />;
      case 'global': return <Globe className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    if (type.includes('free')) return <Gift className="h-4 w-4" />;
    return <Percent className="h-4 w-4" />;
  };

  const formatRuleValue = (rule: DiscountRule) => {
    if (rule.type === 'percentage') return `${rule.value}%`;
    if (rule.type === 'fixed_amount') return `LKR ${rule.value}`;
    return `LKR ${rule.value}`;
  };

  const formatPromotionalRule = (rule: PromotionalRule) => {
    if (rule.type === 'buy_x_get_y_free') {
      return `Buy ${rule.buyQuantity} Get ${rule.getQuantity} Free`;
    }
    if (rule.type === 'buy_x_get_y_discount') {
      return `Buy ${rule.buyQuantity} Get ${rule.getQuantity} at ${rule.discountPercentage}% off`;
    }
    return rule.name;
  };

  const activeDiscountRules = discountRules.filter(rule => rule.isActive);
  const activePromotionalRules = promotionalRules.filter(rule => rule.isActive);

  if (showCreateDiscountForm) {
    return (
      <CreateDiscountRuleForm
        customers={customers}
        products={products}
        agents={agents}
        onSubmit={onCreateDiscountRule}
        onCancel={() => setShowCreateDiscountForm(false)}
      />
    );
  }

  if (showCreatePromotionalForm) {
    return (
      <CreatePromotionalRuleForm
        customers={customers}
        products={products}
        agents={agents}
        onSubmit={onCreatePromotionalRule}
        onCancel={() => setShowCreatePromotionalForm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Discount & Promotional Rules</h2>
          <p className="text-gray-600">
            Manage special discounts and promotional offers for customers, products, and agents
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreatePromotionalForm(true)} className="bg-green-600 hover:bg-green-700">
            <Gift className="h-4 w-4 mr-2" />
            Add Promotional Rule
          </Button>
          <Button onClick={() => setShowCreateDiscountForm(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Discount Rule
          </Button>
        </div>
      </div>

      <Tabs defaultValue="discount" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="discount" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Discount Rules ({activeDiscountRules.length})
          </TabsTrigger>
          <TabsTrigger value="promotional" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Promotional Rules ({activePromotionalRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discount" className="space-y-4">
          {discountRules.map((rule) => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      {rule.name}
                      <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getApplicableToIcon(rule.applicableTo)}
                        {rule.applicableTo}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {rule.description || 'No description provided'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600">
                      {formatRuleValue(rule)} OFF
                    </p>
                    {rule.maxUsageCount && (
                      <p className="text-sm text-gray-500">
                        Used: {rule.currentUsageCount}/{rule.maxUsageCount}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {rule.validFrom.toLocaleDateString()} - {rule.validTo.toLocaleDateString()}
                    </div>
                  </div>
                  
                  {rule.targetNames.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Applied to:</p>
                      <div className="flex flex-wrap gap-1">
                        {rule.targetNames.slice(0, 3).map((name, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                        {rule.targetNames.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{rule.targetNames.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateDiscountRule(rule.id, { isActive: !rule.isActive })}
                    >
                      {rule.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingDiscountRule(rule)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDeleteDiscountRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {discountRules.length === 0 && (
            <div className="text-center py-12">
              <Percent className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No discount rules found</h3>
              <p className="text-gray-600 mb-4">Create your first discount rule to get started</p>
              <Button onClick={() => setShowCreateDiscountForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Discount Rule
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="promotional" className="space-y-4">
          {promotionalRules.map((rule) => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      {rule.name}
                      <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getTypeIcon(rule.type)}
                        {rule.type.replace(/_/g, ' ')}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {rule.description || formatPromotionalRule(rule)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600">
                      {formatPromotionalRule(rule)}
                    </p>
                    {rule.maxUsageCount && (
                      <p className="text-sm text-gray-500">
                        Used: {rule.currentUsageCount}/{rule.maxUsageCount}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {rule.validFrom.toLocaleDateString()} - {rule.validTo.toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {rule.buyProductNames.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Buy Products:</p>
                        <div className="flex flex-wrap gap-1">
                          {rule.buyProductNames.slice(0, 2).map((name, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                          {rule.buyProductNames.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{rule.buyProductNames.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {rule.getProductNames.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Get Products:</p>
                        <div className="flex flex-wrap gap-1">
                          {rule.getProductNames.slice(0, 2).map((name, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                          {rule.getProductNames.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{rule.getProductNames.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdatePromotionalRule(rule.id, { isActive: !rule.isActive })}
                    >
                      {rule.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingPromotionalRule(rule)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDeletePromotionalRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {promotionalRules.length === 0 && (
            <div className="text-center py-12">
              <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No promotional rules found</h3>
              <p className="text-gray-600 mb-4">Create your first promotional rule to get started</p>
              <Button onClick={() => setShowCreatePromotionalForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Promotional Rule
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DiscountRulesManagement;
