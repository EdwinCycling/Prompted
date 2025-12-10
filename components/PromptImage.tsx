import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { ImageModal } from './ImageModal';

interface PromptImageProps {
  imageUrl: string | null;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  showModal?: boolean;
  promptText?: string;
  onLoad?: () => void;
}

export const PromptImage: React.FC<PromptImageProps> = ({ 
  imageUrl, 
  alt, 
  className = "", 
  onClick, 
  showModal = false,
  promptText = "",
  onLoad
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !imageUrl) return;
    
    const load = async () => {
      if (/^https?:\/\//.test(imageUrl)) {
        setSrc(imageUrl);
        return;
      }
      try {
        const { data } = await supabase.storage
          .from('prompt-images')
          .createSignedUrl(imageUrl, 60 * 60);
        if (data?.signedUrl) setSrc(data.signedUrl);
        else setError(true);
      } catch {
        setError(true);
      }
    };
    load();
  }, [imageUrl, isVisible]);

  if (!imageUrl || error) return null;

  return (
    <>
      <div ref={ref} className={`relative ${className} ${!src ? 'bg-zinc-800 animate-pulse' : ''}`}>
        {src && (
          <img 
            src={src} 
            alt={alt} 
            className={`w-full h-full object-cover transition-opacity duration-300 ${className}`}
            loading="lazy"
            onClick={(e) => {
              if (showModal) {
                e.stopPropagation();
                setIsModalOpen(true);
              }
              onClick?.(e);
            }}
            onLoad={onLoad}
          />
        )}
      </div>
      {showModal && (
        <ImageModal 
          open={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          imageUrl={src} 
          promptText={promptText} 
        />
      )}
    </>
  );
};
