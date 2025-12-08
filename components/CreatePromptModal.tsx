import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, Send, Upload } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { supabase } from '../services/supabaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Tag } from '../types';

interface CreatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const CreatePromptModal: React.FC<CreatePromptModalProps> = ({ isOpen, onClose, userId }) => {
  const [content, setContent] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const queryClient = useQueryClient();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('*').order('name');
      if (error) throw error;
      return data as Tag[];
    }
  });

  // Reset state when closed
  React.useEffect(() => {
    if (!isOpen) {
      setContent('');
      setImageFiles([]);
      setPreviewUrls([]);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length) {
      setImageFiles(files);
      const urls = files.map((f) => URL.createObjectURL(f));
      setPreviewUrls(urls);
    }
  };

  const addImages = (files: File[]) => {
    if (!files.length) return;
    setImageFiles((prev) => [...prev, ...files]);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls((prev) => [...prev, ...urls]);
  };

  const handlePaste = (e: React.ClipboardEvent | ClipboardEvent) => {
    const cd: DataTransfer | null = ('clipboardData' in e && e.clipboardData) ? e.clipboardData : null;
    if (!cd) return;
    let file: File | null = null;
    const firstFromFiles = (Array.from(cd.files || []) as File[]).find((f) => f.type?.startsWith('image'));
    if (firstFromFiles) {
      file = firstFromFiles;
    } else {
      const item = Array.from(cd.items || []).find((it) => it.type?.startsWith('image'));
      if (item) {
        const f = item.getAsFile();
        if (f) {
          const name = `pasted-${Date.now()}.${(f.type.split('/')[1] || 'png')}`;
          file = new File([f], name, { type: f.type });
        }
      }
    }
    if (file) {
      // Only prevent default when we actually handle an image paste
      if ('preventDefault' in e && typeof e.preventDefault === 'function') e.preventDefault();
      addImages([file]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = (Array.from(e.dataTransfer.files || []) as File[]).filter((f) => f.type.startsWith('image'));
    if (files.length) addImages(files);
  };

  React.useEffect(() => {
    // no-op
  }, [isOpen]);

  const uploadPromptMutation = useMutation({
    mutationFn: async () => {
      let publicImageUrl = null;

      // 1. Upload Image if exists
      let uploaded: { path: string; publicUrl: string }[] = [];
      if (imageFiles.length) {
        for (const file of imageFiles) {
          const compressedBlob = await compressImage(file, 512, 0.6);
          const path = `${userId}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('prompt-images')
            .upload(path, compressedBlob, { contentType: 'image/jpeg', upsert: false });
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage
            .from('prompt-images')
            .getPublicUrl(path);
          uploaded.push({ path, publicUrl });
        }
        publicImageUrl = uploaded[0]?.publicUrl || null;
      }

      // 2. Insert Record
      const { data: inserted, error: insertError } = await supabase
        .from('prompts')
        .insert({
          user_id: userId,
          content,
          image_url: publicImageUrl
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (inserted && selectedTagIds.length > 0) {
        const rows = selectedTagIds.map((tag_id) => ({ prompt_id: inserted.id, tag_id, user_id: userId }));
        const { error: ptErr } = await supabase.from('prompt_tags').insert(rows);
        if (ptErr) throw ptErr;
      }

      if (inserted && uploaded.length > 0) {
        const imgRows = uploaded.map((u) => ({ prompt_id: inserted.id, user_id: userId, path: u.path, image_url: u.publicUrl }));
        const { error: piErr } = await supabase.from('prompt_images').insert(imgRows);
        if (piErr) throw piErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt-tags'] });
      onClose();
    },
    onError: (error: any) => {
      console.error(error);
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-3xl bg-surface sm:rounded-2xl rounded-t-2xl border border-border shadow-2xl flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-10 fade-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-white">New Prompt</h2>
          <button onClick={onClose} className="p-2 text-muted hover:text-white rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto no-scrollbar flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)
            }
            onPaste={handlePaste}
            placeholder="What's on your mind? e.g., 'A cyberpunk street scene...'"
            className="w-full bg-transparent text-lg text-white placeholder-muted border-none focus:ring-0 resize-none min-h-[40vh] sm:min-h-[50vh]"
            autoFocus
          />

          {previewUrls.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {previewUrls.map((url) => (
                <div key={url} className="relative rounded-lg overflow-hidden border border-border">
                  <img src={url} alt="Preview" className="w-full max-h-[24vh] object-contain" />
                </div>
              ))}
            </div>
          )}

          {/* Tag selector */}
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
                <div className="text-muted text-sm">No tags. Create some in Manage Tags.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-zinc-900/50 sm:rounded-b-2xl flex items-center justify-between">
          <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <ImageIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Add Image</span>
          </button>
          <span className="text-xs text-muted ml-2">Plak of sleep afbeelding</span>

          <button
            onClick={() => uploadPromptMutation.mutate()}
            disabled={!content.trim() || uploadPromptMutation.isPending}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-full font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {uploadPromptMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
