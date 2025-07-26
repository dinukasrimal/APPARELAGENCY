import React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

const ImageModal = ({ isOpen, onClose, imageUrl, title }: ImageModalProps) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full">
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white hover:bg-opacity-75"
        >
          <X className="h-4 w-4" />
        </Button>
        
        {/* Title */}
        {title && (
          <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
            <h3 className="text-sm font-medium">{title}</h3>
          </div>
        )}
        
        {/* Image */}
        <img
          src={imageUrl}
          alt={title || 'Image'}
          className="w-full h-full object-contain rounded-lg"
          style={{ maxHeight: '90vh' }}
        />
      </div>
    </div>
  );
};

export default ImageModal;