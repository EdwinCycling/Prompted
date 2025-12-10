import React from 'react';
import { X, Plus, Trash2, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { Tag } from '../types';
import { toast } from 'sonner';

interface TagsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const TagsManager: React.FC<TagsManagerProps> = ({ isOpen, onClose, userId }) => {
  const queryClient = useQueryClient();
  const [newName, setNewName] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState('');

  const { data: tags } = useQuery({
    queryKey: ['tags', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id,name')
        .eq('user_id', userId)
        .order('name');
      if (error) throw error;
      return data as Tag[];
    }
  });

  const [lastActionAt, setLastActionAt] = React.useState(0);
  const throttleOk = () => {
    const now = Date.now();
    if (now - lastActionAt < 1500) { toast.error('Please wait…'); return false; }
    setLastActionAt(now); return true;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error('Name is required');
      const { error } = await supabase.from('tags').insert({ user_id: userId, name });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag created');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create tag')
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const name = editingName.trim();
      if (!editingId || !name) throw new Error('Invalid edit');
      const { error } = await supabase.from('tags').update({ name }).eq('id', editingId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingName('');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag updated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update tag')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['prompt-tags'] });
      toast.success('Tag deleted');
    },
    onError: () => toast.error('Failed to delete tag')
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface sm:rounded-2xl rounded-t-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-white">Manage Tags</h2>
          <button onClick={onClose} className="p-2 text-muted hover:text-white rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New tag name"
              className="flex-1 bg-transparent border border-border rounded-lg px-3 py-2 text-white"
            />
            <button
              onClick={() => { if (!throttleOk()) return; createMutation.mutate(); }}
              className="px-3 py-2 bg-primary text-white rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="space-y-2">
            {tags && tags.length > 0 ? (
              tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                  {editingId === tag.id ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 bg-transparent text-white"
                    />
                  ) : (
                    <span className="text-white">{tag.name}</span>
                  )}
                  <div className="flex items-center gap-2">
                    {editingId === tag.id ? (
                      <button onClick={() => { if (!throttleOk()) return; updateMutation.mutate(); }} className="px-2 py-1 bg-primary text-white rounded">Save</button>
                    ) : (
                      <button onClick={() => { setEditingId(tag.id); setEditingName(tag.name); }} className="p-2 text-muted hover:text-white hover:bg-white/10 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => { if (!throttleOk()) return; deleteMutation.mutate(tag.id); }} className="p-2 text-red-400 hover:bg-red-500/10 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted">No tags yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
