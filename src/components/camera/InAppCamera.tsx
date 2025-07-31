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
      onPhotoTaken(capturedPhoto);
      setCapturedPhoto('');
      // Don't call onCancel() here - let the parent component handle closing
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto('');
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-black/80 text-white">
        <h3 className="text-lg sm:text-xl font-semibold">Camera</h3>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-white hover:bg-white/20">
          <X className="h-5 w-5" />
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
              <div className="absolute inset-4 border-2 border-white/50 border-dashed rounded-lg"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-8 h-8 sm:w-12 sm:h-12 border-2 border-white rounded-full opacity-30"></div>
              </div>
            </div>
          </>
        )}
        
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-4 sm:p-6 bg-black/80">
        {capturedPhoto ? (
          // Photo Review Controls
          <div className="flex justify-center gap-4">
            <Button
              onClick={retakePhoto}
              variant="outline"
              size={isMobile ? "default" : "lg"}
              className="flex-1 max-w-32 h-12 sm:h-auto"
            >
              <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Retake
            </Button>
            <Button
              onClick={confirmPhoto}
              size={isMobile ? "default" : "lg"}
              className="flex-1 max-w-32 h-12 sm:h-auto bg-green-600 hover:bg-green-700"
            >
              Use Photo
            </Button>
          </div>
        ) : (
          // Camera Controls
          <div className="flex justify-center items-center gap-6 sm:gap-8">
            <Button
              onClick={switchCamera}
              variant="outline"
              size={isMobile ? "default" : "lg"}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full p-0"
            >
              <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            
            <Button
              onClick={capturePhoto}
              size={isMobile ? "default" : "lg"}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0 bg-white hover:bg-gray-200"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white border-4 border-gray-800 rounded-full"></div>
            </Button>
            
            <div className="w-10 h-10 sm:w-12 sm:h-12"></div> {/* Spacer for symmetry */}
          </div>
        )}
      </div>
    </div>
  );
};

export default InAppCamera;
