import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { uploadCustomerPhoto, base64ToBlob } from '@/utils/storage';
import { useToast } from '@/hooks/use-toast';

const SupabaseDebug = () => {
  const [user, setUser] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [buckets, setBuckets] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      console.log('Current user:', user);
    };

    // List storage buckets
    const listBuckets = async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        console.error('Error listing buckets:', error);
      } else {
        setBuckets(data || []);
        console.log('Available buckets:', data);
      }
    };

    checkAuth();
    listBuckets();
  }, []);

  const testDirectUpload = async () => {
    setTesting(true);
    console.log('=== STARTING DIRECT UPLOAD TEST ===');
    
    try {
      // Create a simple test image
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText('TEST', 25, 55);
        
        const base64 = canvas.toDataURL('image/png', 1.0);
        console.log('Test image created (first 100 chars):', base64.substring(0, 100));
        
        const blob = base64ToBlob(base64, 'image/png');
        console.log('Blob details:', {
          size: blob.size,
          type: blob.type
        });
        
        // Test 1: Direct Supabase upload
        console.log('--- Test 1: Direct Supabase Upload ---');
        const testPath = `test/direct-${Date.now()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('customer-photos')
          .upload(testPath, blob);
        
        console.log('Direct upload result:', { uploadData, uploadError });
        
        if (uploadError) {
          toast({
            title: "Direct Upload Failed",
            description: uploadError.message,
            variant: "destructive",
          });
        } else {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('customer-photos')
            .getPublicUrl(testPath);
          
          console.log('Public URL:', urlData.publicUrl);
          
          toast({
            title: "Direct Upload Success",
            description: `File uploaded to: ${urlData.publicUrl}`,
          });
        }
        
        // Test 2: Using our utility function
        console.log('--- Test 2: Using Utility Function ---');
        const utilResult = await uploadCustomerPhoto(blob, 'debug-test');
        console.log('Utility upload result:', utilResult);
        
        if (utilResult.success) {
          toast({
            title: "Utility Upload Success",
            description: `Utility upload worked: ${utilResult.url}`,
          });
        } else {
          toast({
            title: "Utility Upload Failed",
            description: utilResult.error || 'Unknown error',
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: "Test Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Supabase Storage Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold">Authentication Status:</h4>
          <p className="text-sm">{user ? `Logged in as: ${user.email}` : 'Not authenticated'}</p>
        </div>
        
        <div>
          <h4 className="font-semibold">Available Buckets:</h4>
          <ul className="text-sm">
            {buckets.map(bucket => (
              <li key={bucket.id}>
                {bucket.name} ({bucket.public ? 'Public' : 'Private'})
              </li>
            ))}
          </ul>
        </div>
        
        <Button 
          onClick={testDirectUpload} 
          disabled={testing || !user}
          className="bg-green-600 hover:bg-green-700"
        >
          {testing ? 'Testing...' : 'Test Storage Upload'}
        </Button>
        
        {!user && (
          <p className="text-red-600 text-sm">
            ⚠️ Not authenticated - this could be why uploads are failing
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SupabaseDebug;