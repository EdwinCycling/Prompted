import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, Save, Copy } from 'lucide-react';
import { compressImage, sanitizeFileName, validateImageFile } from '../utils/imageUtils';
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const addFilesInputRef = useRef<HTMLInputElement>(null);

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('id,name').eq('user_id', userId).order('name');
      if (error) throw error;
      return data as Tag[];
    }
  });

  const { data: existing } = useQuery({
    queryKey: ['prompt-tags', promptId],
    queryFn: async () => {
      const { data, error } = await supabase.from('prompt_tags').select('tag_id').eq('prompt_id', promptId).eq('user_id', userId);
      if (error) throw error;
      return (data || []) as { tag_id: string }[];
    },
    enabled: isOpen
  });

  const [tagsTouched, setTagsTouched] = useState(false);

  React.useEffect(() => {
    if (existing && !tagsTouched) setSelectedTagIds(existing.map((x) => x.tag_id));
  }, [existing, tagsTouched]);

  const { data: images, refetch: refetchImages } = useQuery({
    queryKey: ['prompt-images', promptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompt_images')
        .select('id,path,image_url')
        .eq('prompt_id', promptId)
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []) as PromptImage[];
    },
    enabled: isOpen
  });

  React.useEffect(() => {
    const resolve = async () => {
      if (!previewUrl) { setResolvedPreviewUrl(null); return; }
      if (/^https?:\/\//.test(previewUrl) || /^blob:/.test(previewUrl) || /^data:/.test(previewUrl)) { setResolvedPreviewUrl(previewUrl); return; }
      try {
        const { data, error } = await supabase.storage
          .from('prompt-images')
          .createSignedUrl(previewUrl, 60 * 60);
        if (!error && data?.signedUrl) setResolvedPreviewUrl(data.signedUrl);
        else setResolvedPreviewUrl(null);
      } catch {
        setResolvedPreviewUrl(null);
      }
    };
    resolve();
  }, [previewUrl]);

  const [signedImages, setSignedImages] = useState<Record<string, string>>({});
  React.useEffect(() => {
    const run = async () => {
      const map: Record<string, string> = {};
      for (const img of images || []) {
        const url = img.image_url;
        if (/^https?:\/\//.test(url)) { map[img.id] = url; continue; }
        const { data } = await supabase.storage.from('prompt-images').createSignedUrl(url, 60 * 60);
        if (data?.signedUrl) map[img.id] = data.signedUrl;
      }
      setSignedImages(map);
    };
    run();
  }, [images]);

  React.useEffect(() => {
    if (previewUrl && /^blob:/.test(previewUrl) && images && images.length > 0) {
      setPreviewUrl(null);
    }
  }, [images, previewUrl]);

  const [addFiles, setAddFiles] = useState<File[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;
    const first = files[0];
    const check = validateImageFile(first);
    if (!check.ok) { toast.error(check.error || 'Invalid image'); return; }
    setAddFiles([first]);
    try {
      const url = URL.createObjectURL(first);
      setPreviewUrl(url);
    } catch {}
    addImagesMutation.mutate([first]);
    e.currentTarget.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent | ClipboardEvent) => {
    const cd: DataTransfer | null = ('clipboardData' in e && e.clipboardData) ? e.clipboardData : null;
    if (!cd) return;
    let file: File | null = null;
    const firstFromFiles = (Array.from(cd.files || []) as File[]).find((f) => f.type?.startsWith('image'));
    if (firstFromFiles) {
      const check = validateImageFile(firstFromFiles);
      if (!check.ok) { if ('preventDefault' in e && typeof e.preventDefault === 'function') e.preventDefault(); toast.error(check.error || 'Invalid image'); return; }
      file = firstFromFiles;
    } else {
      const item = Array.from(cd.items || []).find((it) => it.type?.startsWith('image'));
      if (item) {
        const f = item.getAsFile();
        if (f) {
          const name = `pasted-${Date.now()}.${(f.type.split('/')[1] || 'png')}`;
          file = new File([f], name, { type: f.type });
          const check = validateImageFile(file);
          if (!check.ok) { if ('preventDefault' in e && typeof e.preventDefault === 'function') e.preventDefault(); toast.error(check.error || 'Invalid image'); return; }
        }
      }
    }
    if (file) {
      if ('preventDefault' in e && typeof e.preventDefault === 'function') e.preventDefault();
      try {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } catch {}
      addImagesMutation.mutate([file]);
    }
  };

  const addImagesMutation = useMutation({
    mutationFn: async (files: File[]): Promise<{ prompt_id: string; user_id: string; path: string; image_url: string }[]> => {
      if (!files.length) return [];
      const file = files[0];
      // Remove existing images for this prompt (enforce single image)
      const { data: existingRows } = await supabase
        .from('prompt_images')
        .select('id,path')
        .eq('prompt_id', promptId)
        .eq('user_id', userId);
      const existingPaths = (existingRows || []).map((r: any) => r.path).filter((p: string) => p.startsWith(`${userId}/`));
      if (existingPaths.length) {
        await supabase.storage.from('prompt-images').remove(existingPaths);
        await supabase.from('prompt_images').delete().eq('prompt_id', promptId).eq('user_id', userId);
      }

      const preCheck = validateImageFile(file);
      if (!preCheck.ok) { throw new Error(preCheck.error || 'Invalid image'); }
      const compressed = await compressImage(file, 512, 0.6);
      const safe = sanitizeFileName(file.name);
      const path = `${userId}/${Date.now()}-${safe}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('prompt-images')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;

      const row = { prompt_id: promptId, user_id: userId, path, image_url: path };
      const { error: insErr } = await supabase.from('prompt_images').insert(row);
      if (insErr) throw insErr;
      // Set prompt main image
      await supabase.from('prompts').update({ image_url: path }).eq('id', promptId).eq('user_id', userId);
      return [row];
    },
    onSuccess: async (rows) => {
      setAddFiles([]);
      refetchImages();
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      if (rows.length > 0) {
        if (!previewUrl && !initialImageUrl) {
          const firstPath = rows[0].path;
          try {
            await supabase.from('prompts').update({ image_url: firstPath }).eq('id', promptId).eq('user_id', userId);
            setPreviewUrl(null);
            queryClient.invalidateQueries({ queryKey: ['prompts'] });
          } catch {}
        }
      }
    },
    onError: (e: any) => console.error(e)
  });

  const deleteImage = async (img: PromptImage) => {
    try {
      const { error: rmErr } = await supabase.storage.from('prompt-images').remove([img.path]);
      if (rmErr) throw rmErr;
      const { error } = await supabase.from('prompt_images').delete().eq('id', img.id).eq('user_id', userId);
      if (error) throw error;
      await supabase.from('prompts').update({ image_url: null }).eq('id', promptId).eq('user_id', userId);
      refetchImages();
      queryClient.invalidateQueries({ queryKey: ['prompt-images', promptId] });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast.success('Image deleted');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to delete image');
    }
  };

  // Replace image flow removed; use Add Image or paste to update image

  const updateMutation = useMutation({
    mutationFn: async () => {
      const publicImageUrl = initialImageUrl;

      const { error: updateError } = await supabase
        .from('prompts')
        .update({ content, image_url: publicImageUrl })
        .eq('id', promptId)
        .eq('user_id', userId);
      if (updateError) throw updateError;

      if (promptId && existing) {
        const idsToApply = selectedTagIds;
        const { error: delErr } = await supabase
          .from('prompt_tags')
          .delete()
          .eq('prompt_id', promptId)
          .eq('user_id', userId);
        if (delErr) throw delErr;

        if (idsToApply.length > 0) {
          const rows = idsToApply.map((tag_id) => ({ prompt_id: promptId, tag_id, user_id: userId }));
          const { error: insErr } = await supabase.from('prompt_tags').insert(rows);
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt-tags'], exact: true });
      queryClient.invalidateQueries({ queryKey: ['prompt-tags', promptId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      onClose();
    },
    onError: (e: any) => console.error(e)
  });
  const [lastSaveAt, setLastSaveAt] = useState(0);

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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-12 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-surface rounded-2xl border border-border shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh]">
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
            onPaste={handlePaste}
            ref={textRef}
            className="w-full bg-transparent text-lg text-white placeholder-muted border-none focus:ring-0 resize-none min-h-[40vh] sm:min-h-[50vh]"
            autoFocus
          />

          {(previewUrl || (images && images.length > 0)) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {previewUrl ? (
                resolvedPreviewUrl && (
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-border bg-zinc-900/40 flex items-center justify-center">
                    <img src={resolvedPreviewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                    <button 
                      onClick={() => { setPreviewUrl(null); }}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"
                    >
                      ×
                    </button>
                  </div>
                )
              ) : (
                images && images.length > 0 && images.map((img) => (
                  <div key={img.id} className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-border bg-zinc-900/40 flex items-center justify-center">
                    {signedImages[img.id] ? (
                      <img src={signedImages[img.id]} alt="Image" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-full h-full animate-pulse bg-zinc-800" />
                    )}
                    <button onClick={() => deleteImage(img)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full">×</button>
                  </div>
                ))
              )}
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
                      onClick={() => {
                        setTagsTouched(true);
                        setSelectedTagIds((prev) => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]);
                      }}
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
          <input type="file" accept="image/*" multiple className="hidden" ref={addFilesInputRef} onChange={handleAddFiles} />
          <div className="flex items-center gap-2">
            <button onClick={() => addFilesInputRef.current?.click()} className="px-4 py-2 rounded-full border border-border text-white hover:bg-white/10">Add Image</button>
            {addImagesMutation.isPending && (
              <span className="text-xs text-muted">Uploading…</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="px-4 py-2 rounded-full border border-border text-white hover:bg-white/10 flex items-center gap-2">
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button onClick={() => { const now = Date.now(); if (now - lastSaveAt < 2000) { toast.error('Please wait…'); return; } setLastSaveAt(now); updateMutation.mutate(); }} disabled={!content.trim() || updateMutation.isPending} className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-full font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95">
              {updateMutation.isPending ? (<Loader2 className="w-4 h-4 animate-spin" />) : (<Save className="w-4 h-4" />)}
              Save Changes
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-full border border-border text-sm text-muted hover:text-white hover:border-white/40 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
