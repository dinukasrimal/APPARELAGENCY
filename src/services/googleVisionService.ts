
interface OCRResult {
  extractedText: string;
  confidence: number;
}

interface VisionAPIResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string;
      boundingPoly: any;
    }>;
    error?: {
      code: number;
      message: string;
    };
  }>;
}

export class GoogleVisionService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extractTextFromImage(imageBase64: string): Promise<OCRResult> {
    try {
      console.log('GoogleVisionService: Starting OCR processing...');
      
      const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageBase64
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Vision API error: ${response.status} - ${response.statusText}`);
      }

      const data: VisionAPIResponse = await response.json();
      
      if (data.responses[0]?.error) {
        throw new Error(`Vision API error: ${data.responses[0].error.message}`);
      }

      const textAnnotations = data.responses[0]?.textAnnotations;
      if (!textAnnotations || textAnnotations.length === 0) {
        return { extractedText: '', confidence: 0 };
      }

      const extractedText = textAnnotations[0].description;
      console.log('GoogleVisionService: OCR completed successfully. Text length:', extractedText.length);
      
      return {
        extractedText,
        confidence: 0.9
      };
    } catch (error) {
      console.error('GoogleVisionService: OCR processing failed:', error);
      throw error;
    }
  }

  async processPDFForOCR(file: File): Promise<OCRResult> {
    try {
      console.log('GoogleVisionService: Processing PDF file:', file.name);
      
      if (file.type !== 'application/pdf') {
        throw new Error('File must be a PDF');
      }

      const pdfAsImage = await this.convertPDFToImage(file);
      console.log('GoogleVisionService: PDF converted to image successfully');
      
      const result = await this.extractTextFromImage(pdfAsImage);
      console.log('GoogleVisionService: PDF OCR processing complete');
      
      return result;
    } catch (error) {
      console.error('GoogleVisionService: PDF processing failed:', error);
      throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async convertPDFToImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const pdfData = new Uint8Array(e.target?.result as ArrayBuffer);
          
          // Import PDF.js dynamically
          const pdfjsLib = await import('pdfjs-dist');
          
          // Set the worker source correctly
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.js',
            import.meta.url
          ).toString();
          
          console.log('GoogleVisionService: Loading PDF document...');
          const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
          
          console.log('GoogleVisionService: Getting first page...');
          const page = await pdf.getPage(1);
          
          // Create canvas
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) {
            throw new Error('Could not get canvas context');
          }
          
          // Set up the viewport with higher scale for better OCR
          const viewport = page.getViewport({ scale: 2.5 });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          console.log('GoogleVisionService: Rendering PDF page to canvas...');
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Convert canvas to base64
          const imageData = canvas.toDataURL('image/png');
          const base64 = imageData.split(',')[1];
          
          console.log('GoogleVisionService: PDF to image conversion completed');
          resolve(base64);
        } catch (error) {
          console.error('GoogleVisionService: Error converting PDF to image:', error);
          reject(new Error('Failed to convert PDF to image. Please ensure the PDF is valid and not corrupted.'));
        }
      };
      
      reader.onerror = () => {
        console.error('GoogleVisionService: Error reading PDF file');
        reject(new Error('Failed to read PDF file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
}

export default GoogleVisionService;
