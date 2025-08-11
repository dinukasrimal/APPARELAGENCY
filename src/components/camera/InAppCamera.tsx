import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface InAppCameraProps {
  onPhotoTaken: (photoData: string) => void;
  onCancel: () => void;
}

const InAppCamera = ({ onPhotoTaken, onCancel }: InAppCameraProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const startCamera = async () => {
    try {
      console.log('Starting in-app camera...');
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported');
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: isMobile ? 720 : 1280, max: 1920 },
          height: { ideal: isMobile ? 480 : 720, max: 1080 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      console.log('In-app camera started successfully');
    } catch (error) {
      console.error('Camera error:', error);
      
      let errorMessage = "Unable to access camera";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Camera permission denied. Please allow camera access.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No camera found on this device.";
        }
      }
      
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.kind);
      });
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const photoData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(photoData);

    toast({
      title: "Photo Captured",
      description: "Photo captured successfully! Review and confirm.",
    });
  };

  const confirmPhoto = () => {
    if (capturedPhoto) {
      console.log('InAppCamera: confirmPhoto called with photo data length:', capturedPhoto.length);
      // Store the photo data before clearing state
      const photoDataToSend = capturedPhoto;
      
      // Clear the captured photo state first
      setCapturedPhoto('');
      
      // Then send the photo data to parent
      console.log('InAppCamera: Calling onPhotoTaken with photo data');
      onPhotoTaken(photoDataToSend);
    } else {
      console.log('InAppCamera: confirmPhoto called but no capturedPhoto available');
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto('');
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col touch-manipulation">
      {/* Header */}
      <div className="flex justify-between items-center p-4 md:p-6 bg-black/80 text-white">
        <h3 className="text-xl md:text-2xl font-semibold">Camera</h3>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-white hover:bg-white/20 touch-manipulation p-3 md:p-2">
          <X className="h-6 w-6 md:h-5 md:w-5" />
        </Button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        {capturedPhoto ? (
          // Photo Preview
          <img 
            src={capturedPhoto} 
            alt="Captured" 
            className="w-full h-full object-cover"
          />
        ) : (
          // Live Camera Feed
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Camera Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 md:inset-6 border-2 border-white/50 border-dashed rounded-lg"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-10 h-10 md:w-16 md:h-16 border-2 border-white rounded-full opacity-30"></div>
              </div>
            </div>
          </>
        )}
        
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-6 md:p-8 bg-black/80">
        {capturedPhoto ? (
          // Photo Review Controls
          <div className="flex justify-center gap-6 md:gap-8">
            <Button
              onClick={retakePhoto}
              variant="outline"
              className="flex-1 max-w-40 md:max-w-48 h-14 md:h-16 text-base md:text-lg touch-manipulation"
            >
              <RotateCcw className="h-5 w-5 md:h-6 md:w-6 mr-2" />
              Retake
            </Button>
            <Button
              onClick={confirmPhoto}
              className="flex-1 max-w-40 md:max-w-48 h-14 md:h-16 text-base md:text-lg bg-green-600 hover:bg-green-700 touch-manipulation"
            >
              Use Photo
            </Button>
          </div>
        ) : (
          // Camera Controls
          <div className="flex justify-center items-center gap-8 md:gap-12">
            <Button
              onClick={switchCamera}
              variant="outline"
              className="w-12 h-12 md:w-16 md:h-16 rounded-full p-0 touch-manipulation"
            >
              <RotateCcw className="h-5 w-5 md:h-6 md:w-6" />
            </Button>
            
            <Button
              onClick={capturePhoto}
              className="w-16 h-16 md:w-20 md:h-20 rounded-full p-0 bg-white hover:bg-gray-200 touch-manipulation"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white border-4 border-gray-800 rounded-full"></div>
            </Button>
            
            <div className="w-12 h-12 md:w-16 md:h-16"></div> {/* Spacer for symmetry */}
          </div>
        )}
      </div>
    </div>
  );
};

export default InAppCamera;
