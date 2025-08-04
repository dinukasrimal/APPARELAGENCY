import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { productAutoMatcherService } from '@/services/product-auto-matcher.service';

interface ProductAutoMatcherProps {
  agencyId: string;
  onComplete?: () => void;
}

const ProductAutoMatcher = ({ agencyId, onComplete }: ProductAutoMatcherProps) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const loadSummary = async () => {
    try {
      setLoading(true);
      const summaryData = await productAutoMatcherService.getUnmatchedSummary(agencyId);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading summary:', error);
      toast({
        title: "Error",
        description: "Failed to load unmatched products summary",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runAutoMatcher = async () => {
    try {
      setLoading(true);
      setResults(null);
      
      const result = await productAutoMatcherService.autoMatchUnmatchedProducts(agencyId);
      setResults(result);
      
      toast({
        title: "Auto-matching completed",
        description: `Matched: ${result.matched}, Created: ${result.created}, Failed: ${result.failed}`,
        variant: result.failed === 0 ? "default" : "destructive"
      });

      // Refresh summary after matching
      await loadSummary();
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error running auto-matcher:', error);
      toast({
        title: "Error",
        description: "Failed to run auto-matching process",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Product Auto-Matcher
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={loadSummary} 
            disabled={loading}
            variant="outline"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Check Unmatched"}
          </Button>
          
          <Button 
            onClick={runAutoMatcher} 
            disabled={loading || !summary}
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Auto-Match Products"}
          </Button>
        </div>

        {summary && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">
                {summary.totalUnmatched} unmatched products found
              </span>
            </div>

            {summary.totalUnmatched > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(summary.unmatchedByCategory).map(([category, count]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span>{category}:</span>
                      <Badge variant="secondary">{count as number}</Badge>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Sample unmatched products:</p>
                  <div className="space-y-1">
                    {summary.sampleUnmatched.slice(0, 5).map((item: any, index: number) => (
                      <div key={index} className="text-xs text-gray-600 truncate">
                        • {item.product_name} ({item.category})
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {results && (
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Auto-matching Results:</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <div className="font-medium text-green-600">{results.matched}</div>
                <div className="text-xs text-gray-600">Matched</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-blue-600">{results.created}</div>
                <div className="text-xs text-gray-600">Created</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-red-600">{results.failed}</div>
                <div className="text-xs text-gray-600">Failed</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 border-t pt-3">
          <p><strong>What this does:</strong></p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Finds products in external inventory without master product links</li>
            <li>Creates missing master products in the products table</li>
            <li>Links external inventory items to appropriate master products</li>
            <li>Improves product categorization and matching</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductAutoMatcher;