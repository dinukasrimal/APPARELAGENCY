import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '@/types/auth';
import { Return, ReturnItem } from '@/types/sales';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Search, Trash2, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PriceType, getAgencyPriceType, getProductPriceForAgency } from '@/utils/agencyPricing';
import { getExcludedProductIdsForAgency } from '@/utils/productVisibility';
import { useDiscountValidation } from '@/hooks/useDiscountValidation';

interface CreateReturnFormProps {
  user: User;
  customers: Customer[];
  products: Product[];
  returns: Return[];
  onSubmit: (returnData: any) => void;
  onCancel: () => void;
}

// One product's sizes, with the quantity coming back in each — the same shape
// the order form uses, so the two screens are worked the same way.
interface GridItem {
  product: Product;
  color: string;
  sizes: Array<{ size: string; quantity: number }>;
}

interface DraftLine {
  key: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Taking goods back from a customer.
 *
 * The customer hands over a bag of stock without knowing which invoice any of
 * it came from, so this asks for the goods, not for an invoice: pick the
 * customer, then enter what came back on the same kind of grid used to take an
 * order. The result is a value, and that value is applied to invoices
 * afterwards (or left as credit) on the Credit screen.
 */
const CreateReturnForm = ({ user, customers, products, returns, onSubmit, onCancel }: CreateReturnFormProps) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [gridItems, setGridItems] = useState<GridItem[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [reason, setReason] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [priceType, setPriceType] = useState<PriceType>('billing_price');
  const [visibleProducts, setVisibleProducts] = useState<Product[]>(products);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const { agencyDiscountLimit, validateDiscount, loading: discountLoading } = useDiscountValidation(user);

  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId);
  // A superuser takes the return on behalf of the customer's own agency, so
  // pricing and the stock that comes back follow the customer, not the user.
  const agencyId = selectedCustomer?.agencyId || user.agencyId;

  // Price list and hidden products follow whichever agency owns the customer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!agencyId) return;
      const [type, excluded] = await Promise.all([
        getAgencyPriceType(agencyId),
        getExcludedProductIdsForAgency(agencyId),
      ]);
      if (cancelled) return;
      setPriceType(type);
      // A product hidden for this agency can't come back into its stock either.
      setVisibleProducts(products.filter(product => product.isActive !== false && !excluded.has(product.id)));
    })();
    return () => { cancelled = true; };
  }, [agencyId, products]);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                         customer.phone.toLowerCase().includes(customerSearchTerm.toLowerCase());
    const matchesAgency = user.role === 'superuser' || customer.agencyId === user.agencyId;
    return matchesSearch && matchesAgency;
  });

  const categories = useMemo(
    () => [...new Set(visibleProducts.map(product => product.category))].filter(Boolean),
    [visibleProducts],
  );

  const subCategories = useMemo(
    () => selectedCategory
      ? [...new Set(visibleProducts
          .filter(product => product.category === selectedCategory)
          .map(product => product.subCategory))].filter(Boolean)
      : [],
    [visibleProducts, selectedCategory],
  );

  const colors = useMemo(
    () => selectedCategory && selectedSubCategory
      ? [...new Set(visibleProducts
          .filter(product => product.category === selectedCategory && product.subCategory === selectedSubCategory)
          .flatMap(product => product.colors || []))].filter(Boolean)
      : [],
    [visibleProducts, selectedCategory, selectedSubCategory],
  );

  // Sizes read in wearing order, not alphabetically, as on the order form.
  const sortSizes = (sizes: string[]) => {
    const preferred = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
    return [...sizes].sort((a, b) => {
      const indexA = preferred.indexOf(a.toUpperCase());
      const indexB = preferred.indexOf(b.toUpperCase());
      if (indexA !== -1 || indexB !== -1) {
        return (indexA === -1 ? preferred.length : indexA) - (indexB === -1 ? preferred.length : indexB);
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  useEffect(() => {
    if (!(selectedCategory && selectedSubCategory && selectedColor)) {
      setGridItems([]);
      return;
    }
    const matching = visibleProducts
      .filter(product =>
        product.category === selectedCategory &&
        product.subCategory === selectedSubCategory &&
        (product.colors || []).includes(selectedColor))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    setGridItems(matching.map(product => ({
      product,
      color: selectedColor,
      sizes: sortSizes(product.sizes?.length ? product.sizes : ['Default']).map(size => ({ size, quantity: 0 })),
    })));
  }, [visibleProducts, selectedCategory, selectedSubCategory, selectedColor]);

  const updateGridQuantity = (productIndex: number, sizeIndex: number, quantity: number) => {
    setGridItems(previous => previous.map((item, i) => (
      i !== productIndex ? item : {
        ...item,
        sizes: item.sizes.map((entry, j) => (j === sizeIndex ? { ...entry, quantity: Math.max(0, quantity) } : entry)),
      }
    )));
  };

  // Moves everything typed into the grid down into the return, then clears the
  // grid so the next category can be worked through.
  const addGridToReturn = () => {
    const additions: DraftLine[] = [];
    gridItems.forEach(item => {
      item.sizes.forEach(entry => {
        if (entry.quantity <= 0) return;
        additions.push({
          key: `${item.product.id}-${item.color}-${entry.size}`,
          productId: item.product.id,
          productName: item.product.name,
          color: item.color,
          size: entry.size,
          quantity: entry.quantity,
          unitPrice: getProductPriceForAgency(item.product, priceType),
        });
      });
    });

    if (additions.length === 0) return;

    setLines(previous => {
      const merged = [...previous];
      additions.forEach(addition => {
        // The same product, colour and size added twice is one line, not two.
        const existing = merged.findIndex(line => line.key === addition.key);
        if (existing >= 0) {
          merged[existing] = { ...merged[existing], quantity: merged[existing].quantity + addition.quantity };
        } else {
          merged.push(addition);
        }
      });
      return merged;
    });

    setGridItems(previous => previous.map(item => ({
      ...item,
      sizes: item.sizes.map(entry => ({ ...entry, quantity: 0 })),
    })));
  };

  const updateLine = (key: string, changes: Partial<DraftLine>) => {
    setLines(previous => previous.map(line => (line.key === key ? { ...line, ...changes } : line)));
  };

  const removeLine = (key: string) => {
    setLines(previous => previous.filter(line => line.key !== key));
  };

  const productById = (productId: string) => visibleProducts.find(product => product.id === productId);

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountAmount = (subtotal * discountPercentage) / 100;
  const total = Math.max(0, subtotal - discountAmount);

  const discountCheck = validateDiscount(discountPercentage);
  // Over the agency's limit the goods still come back into stock, but the
  // credit waits for head office — the same rule an order's discount follows.
  const needsApproval = discountCheck.requiresApproval;

  const canSubmit =
    !!selectedCustomerId &&
    lines.length > 0 &&
    lines.every(line => line.quantity > 0) &&
    reason.trim().length > 0 &&
    !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit || submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    const returnItems: ReturnItem[] = lines.map(line => ({
      id: line.key,
      // Nothing links to an invoice line any more: the goods are identified by
      // what they are, not by where they were sold.
      invoiceItemId: null,
      productId: line.productId,
      productName: line.productName,
      color: line.color,
      size: line.size,
      quantityReturned: line.quantity,
      originalQuantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.quantity * line.unitPrice,
      reason: reason.trim(),
    }));

    onSubmit({
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || '',
      agencyId,
      items: returnItems,
      subtotal,
      discountPercentage,
      discountAmount,
      total,
      reason: reason.trim(),
      requiresApproval: needsApproval,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Returns
        </Button>
        <h3 className="text-lg font-semibold">Take a return</h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Customer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone"
              className="pl-8"
              value={customerSearchTerm}
              onChange={(event) => setCustomerSearchTerm(event.target.value)}
            />
          </div>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {filteredCustomers.slice(0, 50).map(customer => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name} · {customer.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCustomerId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What came back</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-2 text-sm font-semibold">Category</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {categories.map(category => (
                  <Card
                    key={category}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedCategory === category ? 'bg-blue-50 ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => {
                      setSelectedCategory(category);
                      setSelectedSubCategory('');
                      setSelectedColor('');
                    }}
                  >
                    <CardContent className="p-3 text-center">
                      <h3 className="text-sm font-semibold">{category}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {visibleProducts.filter(product => product.category === category).length} products
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {selectedCategory && (
              <div>
                <p className="mb-2 text-sm font-semibold">Sub category</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {subCategories.map(subCategory => (
                    <Card
                      key={subCategory}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedSubCategory === subCategory ? 'bg-blue-50 ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => {
                        setSelectedSubCategory(subCategory);
                        setSelectedColor('');
                      }}
                    >
                      <CardContent className="p-3 text-center">
                        <h3 className="text-sm font-semibold">{subCategory}</h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {visibleProducts.filter(product =>
                            product.category === selectedCategory && product.subCategory === subCategory).length} products
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {selectedSubCategory && (
              <div>
                <p className="mb-2 text-sm font-semibold">Colour</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map(color => (
                    <Badge
                      key={color}
                      variant={selectedColor === color ? 'default' : 'outline'}
                      className={`cursor-pointer px-4 py-2 text-sm transition-all hover:scale-105 ${
                        selectedColor === color ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedColor(color)}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: color.toLowerCase() }}
                        />
                        {color}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {gridItems.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">How many came back?</p>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {gridItems.map((item, productIndex) => (
                    <div key={item.product.id} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h5 className="text-sm font-medium">{item.product.name}</h5>
                        <span className="text-xs text-muted-foreground">
                          LKR {getProductPriceForAgency(item.product, priceType).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {item.sizes.map((entry, sizeIndex) => (
                          <div key={entry.size} className="space-y-1">
                            <label className="text-xs text-muted-foreground">{entry.size}</label>
                            <Input
                              type="number"
                              min={0}
                              placeholder="Qty"
                              className="h-9"
                              value={entry.quantity || ''}
                              onChange={(event) =>
                                updateGridQuantity(productIndex, sizeIndex, Number(event.target.value) || 0)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button className="w-full" onClick={addGridToReturn}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add to return
                </Button>
              </div>
            )}

            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Pick a category, sub category and colour, then enter how many of each size came back.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Product</th>
                      <th className="py-2">Colour</th>
                      <th className="py-2">Size</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Price</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => {
                      const product = productById(line.productId);
                      return (
                        <tr key={line.key} className="border-b last:border-0">
                          <td className="py-2 pr-2">{line.productName}</td>
                          <td className="py-2 pr-2">
                            <Select value={line.color} onValueChange={(value) => updateLine(line.key, { color: value })}>
                              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(product?.colors?.length ? product.colors : ['Default']).map(color => (
                                  <SelectItem key={color} value={color}>{color}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 pr-2">
                            <Select value={line.size} onValueChange={(value) => updateLine(line.key, { size: value })}>
                              <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(product?.sizes?.length ? product.sizes : ['Default']).map(size => (
                                  <SelectItem key={size} value={size}>{size}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 pr-2 text-right">
                            <Input
                              type="number"
                              min={1}
                              className="h-8 w-20 text-right"
                              value={line.quantity}
                              onChange={(event) => updateLine(line.key, { quantity: Math.max(0, Number(event.target.value) || 0) })}
                            />
                          </td>
                          <td className="py-2 pr-2 text-right text-muted-foreground">
                            {line.unitPrice.toLocaleString()}
                          </td>
                          <td className="py-2 pr-2 text-right font-medium">
                            {(line.quantity * line.unitPrice).toLocaleString()}
                          </td>
                          <td className="py-2 text-right">
                            <Button variant="ghost" size="sm" onClick={() => removeLine(line.key)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {lines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value of this return</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Discount %</label>
                {!discountLoading && agencyDiscountLimit !== null && user.role !== 'superuser' && (
                  <p className="text-xs text-muted-foreground">Your limit is {agencyDiscountLimit}%</p>
                )}
              </div>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-9 w-28 text-right"
                value={discountPercentage}
                disabled={discountLoading}
                onChange={(event) =>
                  setDiscountPercentage(Math.max(0, Math.min(100, Number(event.target.value) || 0)))
                }
              />
            </div>

            {discountPercentage > 0 && discountCheck.message && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {discountCheck.message}. The goods still go back into your stock now; the credit can be applied
                once head office approves.
              </p>
            )}

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>LKR {subtotal.toLocaleString()}</span>
              </div>
              {discountPercentage > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Discount ({discountPercentage}%)</span>
                  <span>-LKR {discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span>Credit to the customer</span>
                <span>LKR {total.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                placeholder="Why are these goods coming back?"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isSubmitting ? 'Saving…' : `Take return · LKR ${total.toLocaleString()}`}
        </Button>
      </div>
    </div>
  );
};

export default CreateReturnForm;
