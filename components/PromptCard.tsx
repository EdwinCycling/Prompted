import React from 'react';
import { Prompt } from '../types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { formatDateTime } from '../utils/format';
import { Copy, MoreVertical, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { EditPromptModal } from './EditPromptModal';
import { ImageModal } from './ImageModal';
import { useEffect, useState } from 'react';

interface PromptCardProps {
  prompt: Prompt;
  onDelete: (id: string) => void;
  userId: string;
}

export const PromptCard: React.FC<PromptCardProps> = ({ prompt, onDelete, userId }) => {
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const { data: promptTags } = useQuery({
    queryKey: ['prompt-tags', prompt.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompt_tags')
        .select('tag_id, tags:tag_id(name)')
        .eq('prompt_id', prompt.id);
      if (error) throw error;
      return (data || []) as unknown as { tag_id: string; tags: { name: string } }[];
    }
  });

  useEffect(() => {
    const resolve = async () => {
      if (!prompt.image_url) { setResolvedImageUrl(null); return; }
      if (/^https?:\/\//.test(prompt.image_url)) { setResolvedImageUrl(prompt.image_url); return; }
      try {
        const { data, error } = await supabase.storage
          .from('prompt-images')
          .createSignedUrl(prompt.image_url, 60 * 60);
        if (!error && data?.signedUrl) setResolvedImageUrl(data.signedUrl);
        else setResolvedImageUrl(null);
      } catch {
        setResolvedImageUrl(null);
      }
    };
    resolve();
  }, [prompt.image_url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      if (navigator.vibrate) navigator.vibrate(50);
      toast.success('Prompt copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleDelete = () => {
    setIsConfirmOpen(true);
  };
  const confirmDelete = () => {
    setIsConfirmOpen(false);
    onDelete(prompt.id);
  };

  return (
    <div className="mb-4 bg-surface rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors group relative shadow-sm">
      
      {/* Content Section */}
      <div className="p-4 relative">
        <button
          className="w-full text-left"
          onClick={() => setIsEditOpen(true)}
        >
          {resolvedImageUrl ? (
            <div className="flex items-start gap-3">
              <img
                src={resolvedImageUrl}
                alt="Prompt reference"
                className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-md border border-border"
                loading="lazy"
                onError={() => setResolvedImageUrl(null)}
                onClick={(e) => { e.stopPropagation(); setShowImageModal(true); }}
              />
              <p className="text-sm text-gray-300 font-normal leading-relaxed line-clamp-6">
                {prompt.content}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-300 font-normal leading-relaxed line-clamp-6">
              {prompt.content}
            </p>
          )}
      </button>

      <ImageModal open={showImageModal} onClose={() => setShowImageModal(false)} imageUrl={resolvedImageUrl} promptText={prompt.content} />

        {promptTags && promptTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {promptTags.map((t) => {
              if (!t.tags?.name) return null;
              return (
                <span key={t.tag_id} className="px-3 py-1 text-sm font-medium rounded-full border border-primary/40 bg-primary/25 text-white">
                  {t.tags.name}
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-2 text-xs text-muted">
          Created {formatDateTime(prompt.created_at)} • Edited {formatDateTime(prompt.updated_at || prompt.created_at)}
        </div>
        
        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/50">
           <button 
             onClick={handleCopy}
             className="flex items-center gap-2 text-primary font-medium text-xs uppercase tracking-wider hover:text-primary-hover active:scale-95 transition-transform"
           >
             <Copy className="w-4 h-4" />
             Copy
           </button>

           <div className="relative">
             <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 rounded-full hover:bg-white/5 text-muted hover:text-white transition-colors"
             >
               <MoreVertical className="w-4 h-4" />
             </button>
             
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 bottom-full mb-2 w-40 bg-zinc-950 border border-border rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                    <button 
                      onClick={() => { setIsEditOpen(true); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button 
                     onClick={() => { setShowMenu(false); handleDelete(); }}
                     className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
               </>
            )}
          </div>
        </div>
      </div>
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsConfirmOpen(false)} />
          <div className="relative w-full max-w-sm bg-surface rounded-2xl border border-border shadow-2xl">
            <div className="p-4 border-b border-border">
              <h3 className="text-white font-semibold text-lg">Verwijderen bevestigen</h3>
            </div>
            <div className="p-4 text-sm text-muted">
              Weet je zeker dat je deze prompt wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </div>
            <div className="p-4 border-t border-border flex items-center justify-end gap-2">
              <button onClick={() => setIsConfirmOpen(false)} className="px-4 py-2 rounded-lg border border-border text-white hover:bg-white/10">Annuleren</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">Verwijderen</button>
            </div>
          </div>
        </div>
      )}
      <EditPromptModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        userId={userId}
        promptId={prompt.id}
        initialContent={prompt.content}
        initialImageUrl={prompt.image_url}
      />
    </div>
  );
};
