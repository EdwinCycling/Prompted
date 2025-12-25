import React, { useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { Prompt } from '../types';
import { PromptCard } from './PromptCard';
import { Loader2, Plus, Ghost, XCircle, Grid3x3, Image as ImageIcon, Minus, Plus as PlusIcon } from 'lucide-react';
import { CreatePromptModal } from './CreatePromptModal';
import { toast } from 'sonner';
import { useQuery as useRQ } from '@tanstack/react-query';
import { Tag } from '../types';
import { PromptImage } from './PromptImage';

interface FeedProps {
  userId: string;
}

const PAGE_SIZE = 24;

export const Feed: React.FC<FeedProps> = ({ userId }) => {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [tagMode, setTagMode] = React.useState<'OR' | 'AND'>('OR');
  const [sortField, setSortField] = React.useState<'created_at' | 'updated_at'>('created_at');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  
  const [viewMode, setViewMode] = React.useState<'list' | 'pictures'>(() => {
    try {
      const stored = localStorage.getItem('pv-viewMode');
      return (stored === 'list' || stored === 'pictures') ? stored : 'list';
    } catch {
      return 'list';
    }
  });

  const [density, setDensity] = React.useState<'min' | 'auto' | 'dense' | 'ultra' | 'max'>(() => {
    try {
      const stored = localStorage.getItem('pv-density');
      const valid = ['min', 'auto', 'dense', 'ultra', 'max'];
      return valid.includes(stored || '') ? (stored as any) : 'auto';
    } catch {
      return 'auto';
    }
  });

  React.useEffect(() => {
    try { localStorage.setItem('pv-viewMode', viewMode); } catch {}
  }, [viewMode]);

  React.useEffect(() => {
    try { localStorage.setItem('pv-density', density); } catch {}
  }, [density]);

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

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ['prompts', sortField, sortDir, selectedTagIds, tagMode, userId],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('prompts')
        .select('id,user_id,content,image_url,created_at,updated_at, prompt_tags!left(tag_id, tags(name))')
        .eq('user_id', userId);

      // Filtering logic
      if (selectedTagIds.length > 0) {
        // Since we can't easily do complex filtering on M2M with embedded join in one go for AND/OR,
        // we might need a different approach if we want server-side filtering.
        // For OR, we can find prompt IDs first.
        // For now, let's try a simpler approach:
        // If we filter, we might just load matching IDs and then fetch details?
        // Or we use the inner join trick for OR.
        
        // This handles "OR" somewhat if we use !inner, but then we lose prompts that don't match.
        // And we get duplicate rows if multiple tags match.
        
        // For simplicity and performance, we'll fetch matching IDs first if there are tags.
        // This is 2 round trips but much lighter than fetching all data.
        
        // Step 1: Get matching Prompt IDs
        let tagQuery = supabase.from('prompt_tags').select('prompt_id').eq('user_id', userId);
        if (tagMode === 'AND') {
             // Hard to do AND in one query without RPC.
             // We can do it in memory if the dataset isn't huge, but "database traffic" is the concern.
             // Let's stick to "OR" logic for the query, and maybe refine later?
             // Actually, if we filter by tags, we probably want to see only those prompts.
             tagQuery = tagQuery.in('tag_id', selectedTagIds);
        } else {
             tagQuery = tagQuery.in('tag_id', selectedTagIds);
        }
        
        const { data: tagData, error: tagError } = await tagQuery;
        if (tagError) throw tagError;
        
        let matchingIds = (tagData || []).map(x => x.prompt_id);
        
        // If AND mode, we need to filter locally on the IDs
        if (tagMode === 'AND') {
             // Group by prompt_id and count matches
             const counts: Record<string, number> = {};
             tagData?.forEach(x => { counts[x.prompt_id] = (counts[x.prompt_id] || 0) + 1; });
             matchingIds = Object.keys(counts).filter(id => counts[id] >= selectedTagIds.length);
        }
        
        // Use unique IDs
        matchingIds = [...new Set(matchingIds)];
        
        if (matchingIds.length === 0) return []; // No matches
        
        query = query.in('id', matchingIds);
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await query
        .order(sortField, { ascending: sortDir === 'asc' })
        .range(from, to);
      
      if (error) throw error;

      const rows = (data || []) as unknown as (Prompt & {
        prompt_tags?: { tag_id: string; tags: { name?: string }[] | { name?: string } | null }[] | null;
      })[];

      return rows.map((p) => {
        const normalizedTags = (p.prompt_tags || [])
          .map((pt) => {
            const name = Array.isArray(pt.tags) ? pt.tags[0]?.name : pt.tags?.name;
            if (!name) return null;
            return { tag_id: pt.tag_id, tags: { name } };
          })
          .filter((x): x is { tag_id: string; tags: { name: string } } => x !== null);

        return { ...p, prompt_tags: normalizedTags };
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
  });

  // Load more on scroll
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingNextPage) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observerRef.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const { data: tags } = useRQ({
    queryKey: ['tags', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('id,name').eq('user_id', userId).order('name');
      if (error) throw error;
      return data as Tag[];
    }
  });

  const allPrompts = React.useMemo(() => {
    return data?.pages.flatMap(page => page) || [];
  }, [data]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
        const { error } = await supabase.from('prompts').delete().eq('id', id).eq('user_id', userId);
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
  const [lastDeleteAt, setLastDeleteAt] = React.useState(0);

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
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-6">
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
        allPrompts && allPrompts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allPrompts.map((prompt) => (
              <PromptCard 
                  key={prompt.id} 
                  prompt={prompt} 
                  userId={userId}
                  onDelete={(id) => { const now = Date.now(); if (now - lastDeleteAt < 1500) { toast.error('Please wait…'); return; } setLastDeleteAt(now); deleteMutation.mutate(id); }}
                  tagsWithIds={(prompt.prompt_tags || []).map((pt) => ({ tag_id: pt.tag_id, name: pt.tags.name }))}
                  onTagClick={(tagId) => { setSelectedTagIds([tagId]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            ))}
            <div ref={loadMoreRef} className="h-4 w-full" />
            {isFetchingNextPage && <div className="col-span-full flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
              <Ghost className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg">No prompts found.</p>
          </div>
        )
      ) : (
        allPrompts && allPrompts.length > 0 ? (
          <PicturesGrid prompts={allPrompts} colsClass={colsClass} density={density} loadMoreRef={loadMoreRef} isFetching={isFetchingNextPage} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
              <Ghost className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg">No images found.</p>
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
    </div>
  );
};

const PicturesGrid: React.FC<{ 
  prompts: (Prompt & { prompt_tags: { tag_id: string; tags: { name: string } }[] })[]; 
  colsClass: string; 
  density: 'min' | 'auto' | 'dense' | 'ultra' | 'max'; 
  loadMoreRef: (node: HTMLDivElement) => void;
  isFetching: boolean;
}> = ({ prompts, colsClass, density, loadMoreRef, isFetching }) => {
  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (navigator.vibrate) navigator.vibrate(50);
      toast.success('Prompt copied');
    } catch {}
  };

  const imgClass = density === 'min'
    ? 'w-full h-[60vh] sm:h-[65vh] lg:h-[70vh]'
    : 'w-full h-40 sm:h-48 lg:h-56';

  return (
    <div className={`grid ${colsClass} gap-2`}>
      {prompts.map((p) => (
        <button key={p.id} onClick={() => copyPrompt(p.content)} className="group relative bg-surface border border-border rounded-lg overflow-hidden text-left">
          {p.image_url ? (
            <div className={imgClass}>
              <PromptImage
                imageUrl={p.image_url}
                alt=""
                className="w-full h-full"
                promptText={p.content}
              />
            </div>
          ) : (
            <div className={imgClass + ' p-3 flex items-start justify-start'}>
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-6">
                {p.content}
              </p>
            </div>
          )}
          {p.prompt_tags && p.prompt_tags.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex flex-wrap gap-1">
              {p.prompt_tags.slice(0, 3).map((pt) => (
                <span key={pt.tag_id} className="px-2 py-0.5 text-xs rounded-full border border-primary/40 bg-primary/25 text-white">
                  {pt.tags.name}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
      <div ref={loadMoreRef} className="col-span-full h-4" />
      {isFetching && <div className="col-span-full flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
    </div>
  );
};
