/**
 * GroupCombobox — select a managed group/tag value with inline "add new" option.
 * Used for mnemonic groups, semantic groups, and word types.
 */
import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag } from "@workspace/api-client-react";

interface GroupComboboxProps {
  value: string;                 // current form value
  onChange: (v: string) => void;
  tags: Tag[];                   // loaded from API
  placeholder?: string;
  emoji?: string;
  onManage?: () => void;         // open manager dialog
  /** If set, the tag value (stored in word) equals tag.value, label = tag.label */
  useLabel?: boolean;            // for word_type: display tag.label but store tag.value
}

export function GroupCombobox({
  value, onChange, tags, placeholder = "Выберите или введите...",
  emoji, onManage, useLabel = false,
}: GroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  // Display label for current value
  const displayLabel = (() => {
    if (!value) return "";
    if (useLabel) {
      const tag = tags.find(t => t.value === value);
      return tag ? tag.label : value;
    }
    return value;
  })();

  const filtered = tags.filter(t => {
    const haystack = useLabel ? t.label.toLowerCase() : t.value.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const exactExists = tags.some(t => {
    const compare = useLabel ? t.label : t.value;
    return compare.toLowerCase() === search.trim().toLowerCase();
  });

  const handleSelect = (tag: Tag) => {
    onChange(useLabel ? tag.value : tag.value);
    setSearch("");
    setOpen(false);
  };

  const handleAddNew = () => {
    const newVal = search.trim();
    if (!newVal) return;
    // For groups, value = label = newVal; caller should create the tag via API
    onChange(newVal);
    setSearch("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
          "hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-ring",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {value ? `${emoji ? emoji + " " : ""}${displayLabel}` : placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <span
              role="button"
              className="text-muted-foreground hover:text-foreground px-0.5"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
            >×</span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (search.trim() && !exactExists) handleAddNew();
                  else if (filtered.length > 0) handleSelect(filtered[0]);
                }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Поиск или новая группа..."
              className="w-full text-sm px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              autoComplete="off" autoCorrect="off" spellCheck={false}
            />
          </div>

          <div className="max-h-48 overflow-y-auto py-1">
            {/* Existing tags */}
            {filtered.map(tag => {
              const isSelected = useLabel ? tag.value === value : tag.value === value;
              const display = useLabel ? tag.label : tag.value;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleSelect(tag)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-accent/50 transition-colors",
                    isSelected && "bg-accent/30 font-medium"
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                  {emoji && <span>{emoji}</span>}
                  {display}
                </button>
              );
            })}

            {/* Add new option when typed something that doesn't exist */}
            {search.trim() && !exactExists && (
              <button
                type="button"
                onClick={handleAddNew}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-primary hover:bg-primary/10 transition-colors border-t"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Добавить «{search.trim()}»
              </button>
            )}

            {filtered.length === 0 && !search.trim() && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Нет групп. Введите название чтобы добавить.</p>
            )}
          </div>

          {/* Manage button */}
          {onManage && (
            <div className="border-t p-1.5">
              <button
                type="button"
                onClick={() => { setOpen(false); onManage(); }}
                className="flex items-center gap-2 w-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded transition-colors"
              >
                <Settings2 className="h-3 w-3" /> Управлять списком
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
