
import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { CompanyInvoice, GRNItem } from '@/types/grn';
import { Product } from '@/types/product';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Plus, Eye, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import GoogleVisionService from '@/services/googleVisionService';
import { InvoiceParser } from '@/utils/invoiceParser';
import APIKeyInput from './APIKeyInput';
import EnhancedGRNItem from './EnhancedGRNItem';

interface GRNUploadProps {
  user: User;
  onGRNCreated: (grn: any) => void;
}

interface Agency {
  id: string;
  name: string;
  email: string;
}

const GRNUpload = ({ user, onGRNCreated }: GRNUploadProps) => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAgency, setSelectedAgency] = useState('');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<GRNItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [visionService, setVisionService] = useState<GoogleVisionService | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [loadingAgencies, setLoadingAgencies] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Only superusers can access GRN Upload
  if (user.role !== 'superuser') {
    return (
      <div className="text-center py-12">
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">Only superusers can access GRN upload.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchAgencies();
    fetchProducts();
    
    // Load API key from localStorage on component mount
    const savedApiKey = localStorage.getItem('google_vision_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setVisionService(new GoogleVisionService(savedApiKey));
    }
  }, []);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, email')
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast({
        title: "Error",
        description: "Failed to fetch agencies",
        variant: "destructive",
      });
    } finally {
      setLoadingAgencies(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*');

      if (error) throw error;
      
      // Map database fields to Product type with proper camelCase properties
      const productData: Product[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        subCategory: item.sub_category || '',
        colors: item.colors || [],
        sizes: item.sizes || [],
        sellingPrice: item.selling_price,
        billingPrice: item.billing_price,
        image: item.image || '',
        description: item.description || '',
      }));
      
      setProducts(productData);
      
      // Set product master in InvoiceParser for enhanced matching
      InvoiceParser.setProductMaster(productData);
      console.log(`Loaded ${productData.length} products for enhanced product matching`);
      
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to fetch product master data",
        variant: "destructive",
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAPIKeySet = (newApiKey: string) => {
    setApiKey(newApiKey);
    setVisionService(new GoogleVisionService(newApiKey));
    toast({
      title: "API Key Set",
      description: "Google Vision API is now ready for enhanced OCR processing."
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setExtractedText('');
      setItems([]);
      toast({
        title: "File uploaded",
        description: "PDF file selected. Use AI OCR to extract and match products."
      });
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a PDF file.",
        variant: "destructive"
      });
    }
  };

  const processWithOCR = async () => {
    if (!selectedFile || !visionService) {
      toast({
        title: "Missing requirements",
        description: "Please upload a file and set your Google Vision API key.",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      let ocrResult: any;
      
      if (selectedFile.type === 'application/pdf') {
        // Process PDF with Google Vision API
        ocrResult = await visionService.processPDFForOCR(selectedFile);
      } else if (selectedFile.type.startsWith('image/')) {
        // Process image directly
        const imageBase64 = await convertImageToBase64(selectedFile);
        ocrResult = await visionService.extractTextFromImage(imageBase64);
      } else {
        throw new Error('Unsupported file type');
      }
      
      setExtractedText(ocrResult.extractedText);
      
      // Parse with enhanced product matching
      const parsedData = InvoiceParser.parseOCRText(ocrResult.extractedText);
      
      if (parsedData.items.length > 0) {
        setItems(parsedData.items);
        toast({
          title: "OCR Processing Complete",
          description: `Successfully extracted and matched ${parsedData.items.length} products from the invoice.`
        });
      } else {
        toast({
          title: "No product matches found",
          description: "OCR couldn't find any products that match your product master. Please add items manually.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Enhanced OCR processing failed:', error);
      toast({
        title: "OCR Processing Failed",
        description: "Failed to process the file with enhanced product matching. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const addItem = () => {
    const newItem: GRNItem = {
      id: Date.now().toString(),
      productName: '',
      color: '',
      size: '',
      quantity: 0,
      unitPrice: 0,
      discountPercentage: 0,
      total: 0
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof GRNItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unitPrice' || field === 'discountPercentage') {
      const item = updatedItems[index];
      const subtotal = item.quantity * item.unitPrice;
      const discountAmount = subtotal * (item.discountPercentage || 0) / 100;
      updatedItems[index].total = subtotal - discountAmount;
    }
    
    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!selectedFile || !selectedAgency || items.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select a file, agency, and add at least one item.",
        variant: "destructive"
      });
      return;
    }

    const selectedAgencyData = agencies.find(a => a.id === selectedAgency);
    const total = items.reduce((sum, item) => sum + item.total, 0);

    const grn = {
      id: `GRN-${Date.now()}`,
      invoiceId: `INV-${Date.now()}`,
      invoiceFileName: selectedFile.name,
      agencyId: selectedAgency,
      agencyName: selectedAgencyData?.name || '',
      items,
      total,
      status: 'pending' as const,
      uploadedBy: user.name,
      assignedAt: new Date(),
      createdAt: new Date()
    };

    onGRNCreated(grn);
    
    // Reset form
    setSelectedFile(null);
    setSelectedAgency('');
    setItems([]);
    setExtractedText('');
    setShowExtractedText(false);
    
    toast({
      title: "GRN Created",
      description: `GRN with enhanced product matching assigned to ${selectedAgencyData?.name}`
    });
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-6">
      {/* API Key Configuration */}
      {!apiKey && (
        <APIKeyInput onAPIKeySet={handleAPIKeySet} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Enhanced OCR Invoice Processing & GRN Creation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div>
            <Label htmlFor="invoice-upload">Upload Invoice (PDF or Image)</Label>
            <div className="mt-2">
              <Input
                id="invoice-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-green-600 mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          </div>

          {/* Agency Selection */}
          <div>
            <Label>Assign to Agency</Label>
            {loadingAgencies ? (
              <div className="text-sm text-gray-500">Loading agencies...</div>
            ) : (
              <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agency" />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map(agency => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Enhanced OCR Processing */}
          {selectedFile && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button 
                  onClick={processWithOCR} 
                  disabled={isProcessing || !visionService || loadingProducts}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Processing with Enhanced AI...' : loadingProducts ? 'Loading Products...' : 'Extract & Match Products with AI'}
                </Button>
                <Button onClick={addItem} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item Manually
                </Button>
                {extractedText && (
                  <Button 
                    onClick={() => setShowExtractedText(!showExtractedText)}
                    variant="ghost"
                    size="sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {showExtractedText ? 'Hide' : 'Show'} Extracted Text
                  </Button>
                )}
              </div>

              {/* Extracted Text Display */}
              {showExtractedText && extractedText && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Raw OCR Extracted Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-50 p-3 rounded whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {extractedText}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Enhanced Items Table */}
          {items.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Matched Invoice Items</h3>
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-6 gap-3 p-3 bg-gray-50 rounded font-medium text-sm">
                  <div>Product</div>
                  <div>Quantity</div>
                  <div>Price</div>
                  <div>Discount %</div>
                  <div>Amount</div>
                  <div>Actions</div>
                </div>
                
                {/* Items */}
                {items.map((item, index) => (
                  <EnhancedGRNItem
                    key={item.id}
                    item={item}
                    index={index}
                    onUpdate={updateItem}
                    onRemove={removeItem}
                  />
                ))}
              </div>

              <div className="text-right">
                <p className="text-lg font-semibold">
                  Total: LKR {totalAmount.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
              Create Enhanced GRN & Assign to Agency
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GRNUpload;
