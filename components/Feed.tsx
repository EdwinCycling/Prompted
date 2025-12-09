import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { Prompt } from '../types';
import { PromptCard } from './PromptCard';
import { Loader2, Plus, Ghost, Settings, XCircle, Grid3x3, Image as ImageIcon, Minus, Plus as PlusIcon } from 'lucide-react';
import { CreatePromptModal } from './CreatePromptModal';
import { toast } from 'sonner';
import { useQuery as useRQ } from '@tanstack/react-query';
import { TagsManager } from './TagsManager';
import { Tag } from '../types';

interface FeedProps {
  userId: string;
}

export const Feed: React.FC<FeedProps> = ({ userId }) => {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isTagsOpen, setIsTagsOpen] = React.useState(false);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [tagMode, setTagMode] = React.useState<'OR' | 'AND'>('OR');
  const [sortField, setSortField] = React.useState<'created_at' | 'updated_at'>('created_at');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = React.useState<'list' | 'pictures'>('list');
  const [density, setDensity] = React.useState<'min' | 'auto' | 'dense' | 'ultra' | 'max'>('auto');
  const isMin = density === 'min';
  const isMax = density === 'max';
  const colsClass = React.useMemo(() => {
    switch (density) {
      case 'min':
        return 'grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1';
      case 'auto':
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      case 'dense':
        return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      case 'ultra':
        return 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5';
      case 'max':
        return 'grid-cols-4 sm:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5';
    }
  }, [density]);
  const queryClient = useQueryClient();

  const { data: prompts, isLoading, error } = useQuery({
    queryKey: ['prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Prompt[];
    },
  });

  const { data: tags } = useRQ({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('*').order('name');
      if (error) throw error;
      return data as Tag[];
    }
  });

  const { data: promptTags } = useRQ({
    queryKey: ['prompt-tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('prompt_tags').select('*');
      if (error) throw error;
      return data as { prompt_id: string; tag_id: string; user_id: string }[];
    }
  });

  const tagNameMap = React.useMemo(() => {
    const byId = new Map<string, string>();
    (tags || []).forEach((t) => byId.set(t.id, t.name));
    const map: Record<string, string[]> = {};
    (promptTags || []).forEach((pt) => {
      const name = byId.get(pt.tag_id);
      if (!name) return;
      (map[pt.prompt_id] ||= []).push(name);
    });
    return map;
  }, [tags, promptTags]);

  const filteredPrompts = React.useMemo(() => {
    if (!prompts) return [] as Prompt[];
    if (!selectedTagIds.length) return prompts;
    const map = new Map<string, string[]>();
    (promptTags || []).forEach((pt) => {
      const arr = map.get(pt.prompt_id) || [];
      arr.push(pt.tag_id);
      map.set(pt.prompt_id, arr);
    });
    return prompts.filter((p) => {
      const tagsOfPrompt = map.get(p.id) || [];
      return tagMode === 'OR'
        ? selectedTagIds.some((id) => tagsOfPrompt.includes(id))
        : selectedTagIds.every((id) => tagsOfPrompt.includes(id));
    });
  }, [prompts, promptTags, selectedTagIds, tagMode]);

  const sortedPrompts = React.useMemo(() => {
    const arr = [...filteredPrompts];
    arr.sort((a, b) => {
      const av = new Date(a[sortField]).getTime();
      const bv = new Date(b[sortField]).getTime();
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [filteredPrompts, sortField, sortDir]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
        const { error } = await supabase.from('prompts').delete().eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['prompts'] });
        toast.success('Prompt deleted');
    },
    onError: (err) => {
        toast.error('Failed to delete prompt');
    }
  });

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-64">
             <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-4 text-red-400 text-center">
            Error loading prompts. Please try refreshing.
        </div>
    )
  }


  return (
    <div className="pb-24 pt-4"> {/* Padding for FAB */}
      {/* Toolbar */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
                <span className="text-muted text-sm">No tags</span>
              )}
            </div>
            {selectedTagIds.length > 0 && (
              <button 
                onClick={() => setSelectedTagIds([])}
                className="p-2 text-muted hover:text-white rounded-lg hover:bg-white/10 ml-2"
                title={`Clear ${selectedTagIds.length} tag(s)`}
                aria-label="Clear tags"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={() => setIsTagsOpen(true)} className="p-2 text-muted hover:text-white rounded-lg hover:bg-white/10 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Manage Tags
          </button>
        </div>
        <div className="mt-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Filter Mode</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setTagMode('OR')} className={`px-2 py-1 rounded border ${tagMode === 'OR' ? 'border-primary text-white bg-primary/20' : 'border-border text-muted hover:text-white hover:border-white/40'}`}>OR</button>
              <button onClick={() => setTagMode('AND')} className={`px-2 py-1 rounded border ${tagMode === 'AND' ? 'border-primary text-white bg-primary/20' : 'border-border text-muted hover:text-white hover:border-white/40'}`}>AND</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Sort</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setSortField('created_at')} className={`px-2 py-1 rounded border ${sortField === 'created_at' ? 'border-primary text-white bg-primary/20' : 'border-border text-muted hover:text-white hover:border-white/40'}`}>Created</button>
              <button onClick={() => setSortField('updated_at')} className={`px-2 py-1 rounded border ${sortField === 'updated_at' ? 'border-primary text-white bg-primary/20' : 'border-border text-muted hover:text-white hover:border-white/40'}`}>Edited</button>
              <button onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="px-2 py-1 rounded border border-border text-sm text-muted hover:text-white hover:border-white/40">{sortDir === 'asc' ? 'Asc' : 'Desc'}</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">View</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded border ${viewMode === 'list' ? 'border-primary text-white bg-primary/20' : 'border-border text-muted hover:text-white hover:border-white/40'}`}>List</button>
              <button onClick={() => setViewMode('pictures')} className={`px-2 py-1 rounded border ${viewMode === 'pictures' ? 'border-primary text-white bg-primary/20' : 'border-border text-muted hover:text-white hover:border-white/40'}`}>Pictures</button>
              {viewMode === 'pictures' && (
                <div className="ml-1 flex items-center gap-1">
                  <button onClick={() => setDensity((d) => d === 'max' ? 'ultra' : d === 'ultra' ? 'dense' : d === 'dense' ? 'auto' : 'min')} disabled={isMin} className="p-1 rounded border border-border text-muted hover:text-white hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed" title="Smaller">
                    <Minus className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDensity((d) => d === 'min' ? 'auto' : d === 'auto' ? 'dense' : d === 'dense' ? 'ultra' : 'max')} disabled={isMax} className="p-1 rounded border border-border text-muted hover:text-white hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed" title="Larger">
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {viewMode === 'list' ? (
        sortedPrompts && sortedPrompts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPrompts.map((prompt) => (
              <PromptCard 
                  key={prompt.id} 
                  prompt={prompt} 
                  userId={userId}
                  onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
              <Ghost className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg">No prompts yet.</p>
              <p className="text-sm">Create your first one below!</p>
          </div>
        )
      ) : (
        sortedPrompts && sortedPrompts.length > 0 ? (
          <PicturesGrid prompts={sortedPrompts} colsClass={colsClass} density={density} tagNameMap={tagNameMap} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
              <Ghost className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg">No images yet.</p>
          </div>
        )
      )}
      

      {/* Floating Action Button */}
      <button
        onClick={() => setIsCreateOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover:bg-primary-hover text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-40"
      >
        <Plus className="w-8 h-8" />
      </button>

      <CreatePromptModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        userId={userId}
      />

      <TagsManager
        isOpen={isTagsOpen}
        onClose={() => setIsTagsOpen(false)}
        userId={userId}
      />
    </div>
  );
};

const PicturesGrid: React.FC<{ prompts: Prompt[]; colsClass: string; density: 'min' | 'auto' | 'dense' | 'ultra' | 'max'; tagNameMap: Record<string, string[]> }> = ({ prompts, colsClass, density, tagNameMap }) => {
  const [signed, setSigned] = React.useState<Record<string, string>>({});
  const [rows, setRows] = React.useState(3);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const getColsNumber = React.useCallback(() => {
    const w = window.innerWidth;
    if (density === 'min') return 1;
    if (density === 'max') {
      if (w >= 640) return 5;
      return 4;
    }
    if (w >= 1280) return density === 'auto' ? 4 : 5;
    if (w >= 1024) return density === 'auto' ? 3 : 5;
    if (w >= 640) {
      if (density === 'auto') return 2;
      if (density === 'dense') return 3;
      return 4;
    }
    if (density === 'auto') return 1;
    if (density === 'dense') return 2;
    return 3;
  }, [density]);
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const map: Record<string, string> = {};
      for (const p of prompts) {
        if (!p.image_url) continue;
        const val = p.image_url;
        if (/^https?:\/\//.test(val)) { map[p.id] = val; continue; }
        const { data } = await supabase.storage.from('prompt-images').createSignedUrl(val, 60 * 60);
        if (data?.signedUrl) map[p.id] = data.signedUrl;
      }
      if (!cancelled) setSigned(map);
    };
    run();
    return () => { cancelled = true; };
  }, [prompts]);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) setRows((r) => r + 3);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (navigator.vibrate) navigator.vibrate(50);
      toast.success('Prompt copied');
    } catch {}
  };

  const cols = getColsNumber();
  const visible = prompts.slice(0, Math.max(cols, cols * rows));

  const imgClass = density === 'min'
    ? 'w-full h-[60vh] sm:h-[65vh] lg:h-[70vh] object-cover'
    : 'w-full h-40 sm:h-48 lg:h-56 object-cover';

  return (
    <div className={`grid ${colsClass} gap-2`}>
      {visible.map((p) => (
        <button key={p.id} onClick={() => copyPrompt(p.content)} className="group relative bg-surface border border-border rounded-lg overflow-hidden text-left">
          {p.image_url ? (
            signed[p.id] ? (
              <img src={signed[p.id]} alt="" className={imgClass} loading="lazy" />
            ) : (
              <div className={imgClass.replace('object-cover', '') + ' animate-pulse bg-zinc-800'} />
            )
          ) : (
            <div className={imgClass.replace('object-cover', '') + ' p-3 flex items-start justify-start'}>
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-6">
                {p.content}
              </p>
            </div>
          )}
          {tagNameMap[p.id] && tagNameMap[p.id].length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex flex-wrap gap-1">
              {tagNameMap[p.id].slice(0, 3).map((name) => (
                <span key={name} className="px-2 py-0.5 text-xs rounded-full border border-primary/40 bg-primary/25 text-white">
                  {name}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
      <div ref={sentinelRef} />
    </div>
  );
};
