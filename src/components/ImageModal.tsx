import { X } from 'lucide-react';

interface ImageModalProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageModal({ src, alt, isOpen, onClose }: ImageModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all z-[110]"
      >
        <X className="w-8 h-8" />
      </button>
      
      <div 
        className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={src} 
          alt={alt} 
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10"
        />
        <div className="absolute bottom-[-40px] left-0 right-0 text-center">
          <p className="text-white/80 font-medium text-sm">{alt}</p>
        </div>
      </div>
    </div>
  );
}
