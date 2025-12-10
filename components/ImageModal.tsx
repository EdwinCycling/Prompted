import React from 'react';
import { X, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  promptText: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({ open, onClose, imageUrl, promptText }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/80" onClick={(e) => { e.stopPropagation(); onClose(); }} onMouseDown={(e) => e.stopPropagation()} />
      <div className="relative max-w-[90vw] max-h-[90vh] bg-surface border border-border rounded-xl shadow-2xl p-3 flex flex-col items-center" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {imageUrl ? (
          <img src={imageUrl} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded-md border border-border" />
        ) : (
          <div className="w-[70vw] h-[60vh] flex items-center justify-center text-muted">No image</div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(promptText).then(() => { toast.success('Prompt copied'); }).catch(() => { toast.error('Failed to copy'); }); }} className="px-4 py-2 rounded-full border border-border text-white hover:bg-white/10 flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Copy
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="px-4 py-2 rounded-full border border-border text-sm text-muted hover:text-white hover:border-white/40">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
