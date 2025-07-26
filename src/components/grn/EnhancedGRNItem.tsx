import { GRNItem } from '@/types/grn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface EnhancedGRNItemProps {
  item: GRNItem;
  index: number;
  onUpdate: (index: number, field: keyof GRNItem, value: any) => void;
  onRemove: (index: number) => void;
}

const EnhancedGRNItem = ({ item, index, onUpdate, onRemove }: EnhancedGRNItemProps) => {
  return (
    <div className="grid grid-cols-6 gap-3 p-3 border rounded">
      <Input
        placeholder="Product"
        value={item.productName}
        onChange={(e) => onUpdate(index, 'productName', e.target.value)}
        className="font-medium"
      />
      <Input
        type="number"
        placeholder="Qty"
        value={item.quantity || ''}
        onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 0)}
      />
      <Input
        type="number"
        placeholder="Price"
        value={item.unitPrice || ''}
        onChange={(e) => onUpdate(index, 'unitPrice', parseFloat(e.target.value) || 0)}
      />
      <Input
        type="number"
        placeholder="Discount %"
        value={item.discountPercentage || ''}
        onChange={(e) => onUpdate(index, 'discountPercentage', parseFloat(e.target.value) || 0)}
      />
      <div className="flex items-center">
        <span className="text-sm font-medium">LKR {item.total.toLocaleString()}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default EnhancedGRNItem;
