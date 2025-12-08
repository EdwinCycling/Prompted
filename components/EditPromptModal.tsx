import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, Save, Copy } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag, PromptImage } from '../types';

interface EditPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  promptId: string;
  initialContent: string;
  initialImageUrl: string | null;
}

export const EditPromptModal: React.FC<EditPromptModalProps> = ({ isOpen, onClose, userId, promptId, initialContent, initialImageUrl }) => {
  const [content, setContent] = useState(initialContent);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const addFilesInputRef = useRef<HTMLInputElement>(null);

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('*').order('name');
      if (error) throw error;
      return data as Tag[];
    }
  });

  const { data: existing } = useQuery({
    queryKey: ['prompt-tags', promptId],
    queryFn: async () => {
      const { data, error } = await supabase.from('prompt_tags').select('tag_id').eq('prompt_id', promptId);
      if (error) throw error;
      return (data || []) as { tag_id: string }[];
    },
    enabled: isOpen
  });

  React.useEffect(() => {
    if (existing) setSelectedTagIds(existing.map((x) => x.tag_id));
  }, [existing]);

  const { data: images, refetch: refetchImages } = useQuery({
    queryKey: ['prompt-images', promptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompt_images')
        .select('*')
        .eq('prompt_id', promptId);
      if (error) throw error;
      return (data || []) as PromptImage[];
    },
    enabled: isOpen
  });

  const [addFiles, setAddFiles] = useState<File[]>([]);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;
    setAddFiles(files);
    addImagesMutation.mutate(files);
    e.currentTarget.value = '';
  };

  const addImagesMutation = useMutation({
    mutationFn: async (files: File[]): Promise<{ prompt_id: string; user_id: string; path: string; image_url: string }[]> => {
      if (!files.length) return [];
      const rows: { prompt_id: string; user_id: string; path: string; image_url: string }[] = [];
      for (const file of files) {
        const compressed = await compressImage(file, 512, 0.6);
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from('prompt-images')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage
          .from('prompt-images')
          .getPublicUrl(path);
        rows.push({ prompt_id: promptId, user_id: userId, path, image_url: publicUrl });
      }
      const { error: insErr } = await supabase.from('prompt_images').insert(rows);
      if (insErr) throw insErr;
      return rows;
    },
    onSuccess: async (rows) => {
      setAddFiles([]);
      refetchImages();
      if (rows.length > 0) {
        if (!previewUrl && !initialImageUrl) {
          const firstUrl = rows[0].image_url;
          try {
            await supabase.from('prompts').update({ image_url: firstUrl }).eq('id', promptId);
            setPreviewUrl(firstUrl);
            queryClient.invalidateQueries({ queryKey: ['prompts'] });
          } catch {}
        }
      }
    },
    onError: (e: any) => console.error(e)
  });

  const deleteImage = async (img: PromptImage) => {
    try {
      await supabase.storage.from('prompt-images').remove([img.path]);
      const { error } = await supabase.from('prompt_images').delete().eq('id', img.id);
      if (error) throw error;
      refetchImages();
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      let publicImageUrl = initialImageUrl;

      if (imageFile) {
        const compressedBlob = await compressImage(imageFile, 512, 0.6);
        const fileName = `${userId}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('prompt-images')
          .upload(fileName, compressedBlob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('prompt-images')
          .getPublicUrl(fileName);
        publicImageUrl = publicUrl;
      }

      const { error: updateError } = await supabase
        .from('prompts')
        .update({ content, image_url: publicImageUrl })
        .eq('id', promptId);
      if (updateError) throw updateError;

      const { error: delErr } = await supabase
        .from('prompt_tags')
        .delete()
        .eq('prompt_id', promptId);
      if (delErr) throw delErr;

      if (selectedTagIds.length > 0) {
        const rows = selectedTagIds.map((tag_id) => ({ prompt_id: promptId, tag_id, user_id: userId }));
        const { error: insErr } = await supabase.from('prompt_tags').insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt-tags'] });
      onClose();
    },
    onError: (e: any) => console.error(e)
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      if (navigator.vibrate) navigator.vibrate(50);
      toast.success('Prompt copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-surface sm:rounded-2xl rounded-t-2xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-white">Edit Prompt</h2>
          <button onClick={onClose} className="p-2 text-muted hover:text-white rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-transparent text-lg text-white placeholder-muted border-none focus:ring-0 resize-none min-h-[40vh] sm:min-h-[50vh]"
          />

          {(previewUrl || (images && images.length > 0)) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {previewUrl && (
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-border bg-zinc-900/40 flex items-center justify-center">
                  <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                  <button 
                    onClick={() => { setImageFile(null); setPreviewUrl(null); }}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"
                  >
                    ×
                  </button>
                </div>
              )}
              {images && images.length > 0 && images.map((img) => (
                <div key={img.id} className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-border bg-zinc-900/40 flex items-center justify-center">
                  <img src={img.image_url} alt="Image" className="max-w-full max-h-full object-contain" />
                  <button onClick={() => deleteImage(img)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <div className="text-sm text-muted mb-2">Tags</div>
            <div className="flex flex-wrap gap-2">
              {tags && tags.length > 0 ? (
                tags.map((tag) => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTagIds((prev) => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                      className={`px-3 py-1 rounded-full border ${active ? 'border-primary text-white bg-primary/20' : 'border-border text-muted hover:text-white hover:border-white/40'}`}
                    >
                      {tag.name}
                    </button>
                  );
                })
              ) : (
                <div className="text-muted text-sm">No tags</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-zinc-900/50 sm:rounded-b-2xl flex items-center justify-between">
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
            <ImageIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Replace Image</span>
          </button>
          <input type="file" accept="image/*" multiple className="hidden" ref={addFilesInputRef} onChange={handleAddFiles} />
          <div className="flex items-center gap-2">
            <button onClick={() => addFilesInputRef.current?.click()} className="px-4 py-2 rounded-full border border-border text-white hover:bg-white/10">Add Images</button>
            {addImagesMutation.isPending && (
              <span className="text-xs text-muted">Uploading…</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="px-4 py-2 rounded-full border border-border text-white hover:bg-white/10 flex items-center gap-2">
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button onClick={() => updateMutation.mutate()} disabled={!content.trim() || updateMutation.isPending} className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-full font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95">
              {updateMutation.isPending ? (<Loader2 className="w-4 h-4 animate-spin" />) : (<Save className="w-4 h-4" />)}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
