'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Database, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────
interface ChoiceItem {
  id?: string;
  label: string;
  value: string;
}

interface ChoicesEditorProps {
  /** Raw choices value from FormQuestion: JSON array string or "dynamic:xxx" */
  value: string;
  /** Called when the user changes the choices string */
  onChange: (value: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function parseStaticChoices(raw: string): ChoiceItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((c: string | { label?: string; value?: string }) => {
        if (typeof c === 'string') return { label: c, value: c };
        return { label: c.label || c.value || '', value: c.value || c.label || '' };
      });
    }
  } catch {
    return raw.split('\n').map(line => line.trim()).filter(Boolean).map(label => ({ label, value: label }));
  }
  return [];
}

function serializeStaticChoices(items: ChoiceItem[]): string {
  return JSON.stringify(items.map(c => ({ label: c.label, value: c.value })));
}

function extractDynamicType(raw: string): string | null {
  if (!raw || !raw.startsWith('dynamic:')) return null;
  return raw.replace('dynamic:', '').trim();
}

// ── Static Choices Editor ────────────────────────────────────────────────
function StaticEditor({ items, onChange }: { items: ChoiceItem[]; onChange: (items: ChoiceItem[]) => void }) {
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (items.some(i => i.label.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This choice already exists');
      return;
    }
    onChange([...items, { label: trimmed, value: trimmed }]);
    setNewLabel('');
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const updated = [...items];
    updated[index] = { ...updated[index], label: trimmed, value: trimmed };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Chips */}
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-muted/30 min-h-[44px]">
          {items.map((item, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="gap-1.5 px-2.5 py-1.5 text-xs font-medium"
            >
              <span>{item.label}</span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="size-3.5 rounded-full flex items-center justify-center hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center p-6 rounded-lg border border-dashed border-muted-foreground/25 text-xs text-muted-foreground">
          No choices added yet
        </div>
      )}

      {/* Add input */}
      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder="Type a new choice..."
          className="flex-1 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!newLabel.trim()} className="gap-1 shrink-0">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {/* Editable list */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">All Choices (click label to edit)</p>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
              <Input
                value={item.label}
                onChange={(e) => handleEdit(idx, e.target.value)}
                className="h-7 text-xs"
              />
              <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(idx)}>
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dynamic List Editor (ManagedList CRUD) ───────────────────────────────
function DynamicEditor({ listType }: { listType: string }) {
  const [items, setItems] = useState<ChoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/managed-lists?listType=${encodeURIComponent(listType)}`);
      if (res.ok) {
        const json = await res.json();
        setItems((json.data || []).map((i: { id: string; label: string; value?: string | null }) => ({
          id: i.id,
          label: i.label,
          value: i.value || i.label,
        })));
      } else {
        toast.error('Failed to load list items');
      }
    } catch {
      toast.error('Failed to load list items');
    } finally {
      setLoading(false);
    }
  }, [listType]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (items.some(i => i.label.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This item already exists');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/managed-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listType, label: trimmed, value: trimmed, sortOrder: items.length }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to add item');
      }
      toast.success(`"${trimmed}" added`);
      setNewLabel('');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (item: ChoiceItem) => {
    if (!item.id) return;
    try {
      const res = await fetch(`/api/managed-lists?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(`"${item.label}" deleted`);
      fetchItems();
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    if (!items[index].id || !items[newIndex].id) return;

    const reordered = [...items];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setItems(reordered);

    try {
      await Promise.all(reordered.map((item, i) =>
        fetch('/api/managed-lists', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, sortOrder: i }),
        })
      ));
    } catch {
      toast.error('Failed to reorder');
      fetchItems();
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-40" />
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Database className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          This uses a <strong>shared list</strong> (<code className="bg-amber-500/20 px-1 rounded">{listType}</code>). Changes affect all forms using this list.
        </p>
      </div>

      {/* Items */}
      {items.length > 0 ? (
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="flex items-center gap-1.5 group">
              <div className="flex flex-col shrink-0">
                <button type="button" onClick={() => handleReorder(idx, 'up')} disabled={idx === 0} className="size-3.5 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-30">
                  <ChevronUp className="size-3" />
                </button>
                <button type="button" onClick={() => handleReorder(idx, 'down')} disabled={idx === items.length - 1} className="size-3.5 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-30">
                  <ChevronDown className="size-3" />
                </button>
              </div>
              <Badge variant="secondary" className="flex-1 justify-start text-xs font-normal">
                {item.label}
              </Badge>
              <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(item)} title="Delete">
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center p-6 rounded-lg border border-dashed border-muted-foreground/25 text-xs text-muted-foreground">
          No items in this list
        </div>
      )}

      {/* Add */}
      <div className="flex gap-2">
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} placeholder="Add new list item..." className="flex-1 text-sm" disabled={adding} />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!newLabel.trim() || adding} className="gap-1 shrink-0">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

// ── Main ChoicesEditor ───────────────────────────────────────────────────
export function ChoicesEditor({ value, onChange }: ChoicesEditorProps) {
  const dynamicType = extractDynamicType(value);
  const [mode, setMode] = useState<'static' | 'dynamic'>(dynamicType ? 'dynamic' : 'static');

  const staticItems = parseStaticChoices(value);

  const handleModeSwitch = (newMode: 'static' | 'dynamic') => {
    setMode(newMode);
    if (newMode === 'static' && dynamicType) {
      onChange('');
    } else if (newMode === 'dynamic' && !dynamicType) {
      onChange('dynamic:');
    }
  };

  const handleStaticChange = (items: ChoiceItem[]) => {
    onChange(serializeStaticChoices(items));
  };

  const handleDynamicTypeChange = (newType: string) => {
    onChange(`dynamic:${newType}`);
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center gap-2 flex-1">
          <Tag className="size-4 text-muted-foreground shrink-0" />
          <Label className="text-xs font-medium cursor-pointer select-none" onClick={() => handleModeSwitch('static')}>
            Static Choices
          </Label>
        </div>
        <Switch
          checked={mode === 'dynamic'}
          onCheckedChange={(checked) => handleModeSwitch(checked ? 'dynamic' : 'static')}
        />
        <div className="flex items-center gap-2 flex-1 justify-end">
          <Label className="text-xs font-medium cursor-pointer text-right select-none" onClick={() => handleModeSwitch('dynamic')}>
            Shared List
          </Label>
          <Database className="size-4 text-muted-foreground shrink-0" />
        </div>
      </div>

      {mode === 'static' ? (
        <StaticEditor items={staticItems} onChange={handleStaticChange} />
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">List Type (shared list identifier)</Label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 rounded-md border border-border shrink-0">
                dynamic:
              </div>
              <Input
                value={dynamicType || ''}
                onChange={(e) => handleDynamicTypeChange(e.target.value)}
                placeholder="e.g. college_institute, year_level, sex"
                className="flex-1 text-sm font-mono"
              />
            </div>
          </div>
          {dynamicType && <DynamicEditor listType={dynamicType} />}
        </>
      )}
    </div>
  );
}
