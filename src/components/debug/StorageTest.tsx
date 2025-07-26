import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { uploadCustomerPhoto, base64ToBlob } from '@/utils/storage';
import { useToast } from '@/hooks/use-toast';

const StorageTest = () => {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testStorageUpload = async () => {
    setTesting(true);
    console.log('Starting storage test...');
    
    try {
      // Create a simple test image as base64
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Draw a simple test pattern
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 50, 50);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(50, 0, 50, 50);
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(0, 50, 50, 50);
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(50, 50, 50, 50);
        
        // Convert to blob
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        console.log('Test image created:', base64.substring(0, 50));
        
        const blob = base64ToBlob(base64, 'image/jpeg');
        console.log('Blob created:', blob.size, 'bytes');
        
        // Test upload
        const result = await uploadCustomerPhoto(blob, 'test-customer');
        console.log('Upload result:', result);
        
        if (result.success) {
          toast({
            title: "Storage Test Success",
            description: `Image uploaded successfully! URL: ${result.url}`,
          });
        } else {
          toast({
            title: "Storage Test Failed",
            description: `Upload failed: ${result.error}`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: "Storage Test Error",
        description: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-4">Storage Upload Test</h3>
      <p className="text-sm text-gray-600 mb-4">
        This will test if the Supabase storage upload is working correctly.
      </p>
      <Button 
        onClick={testStorageUpload} 
        disabled={testing}
        className="bg-blue-600 hover:bg-blue-700"
      >
        {testing ? 'Testing...' : 'Test Storage Upload'}
      </Button>
    </div>
  );
};

export default StorageTest;