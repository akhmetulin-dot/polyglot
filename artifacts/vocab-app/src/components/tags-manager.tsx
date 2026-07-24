/**
 * TagsManagerDialog — full CRUD for a custom tag list (mnemonic_group, semantic_group, word_type).
 * Allows rename and delete. New tags are created inline via GroupCombobox "Add new".
 */
import { useState } from "react";
import { Pencil, Trash2, Check, X, Loader2, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  useListTags, useCreateTag, useUpdateTag, useDeleteTag,
  getListTagsQueryKey,
  type Tag,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface TagsManagerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: string;
  title: string;
  emoji?: string;
  description?: string;
  /** For word_type kind: value != label. For groups: value === label */
  separateValueLabel?: boolean;
}

export function TagsManagerDialog({
  open, onOpenChange, kind, title, emoji, description, separateValueLabel = false,
}: TagsManagerDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListTags(
    { kind },
    { query: { enabled: open } as never }
  );
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const tags = data?.tags ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListTagsQueryKey({ kind }) });

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditLabel(tag.label);
  };

  const handleSaveEdit = (tag: Tag) => {
    if (!editLabel.trim()) return;
    updateTag.mutate(
      { id: tag.id, data: { label: editLabel.trim() } },
      {
        onSuccess: () => { invalidate(); setEditingId(null); },
        onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (tag: Tag) => {
    if (!confirm(`Удалить «${tag.label}»? Слова с этой группой не изменятся.`)) return;
    deleteTag.mutate(
      { id: tag.id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Удалено" }); },
        onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
      }
    );
  };

  const handleCreate = () => {
    const label = newLabel.trim();
    if (!label) return;
    // For groups, value === label; for word_type, use newValue or slugified label
    const value = separateValueLabel
      ? (newValue.trim() || label.toLowerCase().replace(/\s+/g, "_"))
      : label;

    createTag.mutate(
      { data: { kind, value, label } },
      {
        onSuccess: () => {
          invalidate();
          setNewLabel("");
          setNewValue("");
          toast({ title: "Добавлено" });
        },
        onError: () => toast({ title: "Уже существует", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-sm max-h-[85svh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle>{emoji} {title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs mt-1">{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2 py-2">
          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && tags.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Список пуст. Добавьте первую запись.</p>
          )}

          {tags.map(tag => (
            <div key={tag.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              {editingId === tag.id ? (
                <>
                  <Input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(tag); if (e.key === "Escape") setEditingId(null); }}
                    className="h-7 text-xs flex-1"
                    autoFocus
                    autoComplete="off" autoCorrect="off" spellCheck={false}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleSaveEdit(tag)}
                    disabled={updateTag.isPending}
                  >
                    {updateTag.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate">
                    {emoji && <span className="mr-1">{emoji}</span>}
                    {tag.label}
                    {separateValueLabel && tag.value !== tag.label && (
                      <span className="text-muted-foreground text-[10px] ml-1.5">({tag.value})</span>
                    )}
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleStartEdit(tag)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(tag)} disabled={deleteTag.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Добавить</p>
          {separateValueLabel && (
            <Input
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder="Ключ (хранится в БД), напр. formal"
              className="text-xs"
              autoComplete="off" autoCorrect="off" spellCheck={false}
            />
          )}
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
              placeholder={separateValueLabel ? "Название для отображения" : "Название группы"}
              className="text-sm"
              autoComplete="off" autoCorrect="off" spellCheck={false}
            />
            <Button size="sm" onClick={handleCreate} disabled={!newLabel.trim() || createTag.isPending} className="shrink-0">
              {createTag.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
