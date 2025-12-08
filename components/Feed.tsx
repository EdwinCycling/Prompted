import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { Prompt } from '../types';
import { PromptCard } from './PromptCard';
import { Loader2, Plus, Ghost, Settings, XCircle } from 'lucide-react';
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
        </div>
      </div>
      {sortedPrompts && sortedPrompts.length > 0 ? (
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
