import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { 
  useListWords,
  useListTrashedWords,
  useRestoreWord,
  useGetWordHistory,
  useCreateWord,
  useUpdateWord,
  useDeleteWord,
  useBulkImportWords,
  getListWordsQueryKey,
  Word,
  ListWordsSortBy
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, Plus, Trash2, Upload, Edit2, FileSpreadsheet, CheckCircle2, ClipboardPaste, Link2, RotateCcw, History, Languages, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WORD_TYPE_LABELS: Record<string, string> = {
  academic: "Академическое",
  everyday: "Бытовое",
  mixed: "Смешанное",
};

// Auto-detect separator and parse CSV/TSV text
function parseDelimited(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  // Auto-detect: if first line has tabs, use TSV
  const sep = lines[0].includes('\t') ? '\t' : ',';

  const parseRow = (line: string): string[] => {
    if (sep === '\t') return line.split('\t').map(s => s.trim());
    // CSV with quote handling
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === sep && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[\s"']+/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// Parse simple vocabulary XML: <words><word><russian>...</russian>...</word></words>
// or spreadsheet-style XML from LibreOffice/Excel
function parseXml(text: string): Record<string, string>[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");
    if (doc.querySelector("parsererror")) return [];
    
    const knownFields = ["russian", "polish", "german", "english", "mnemonic", "frequencyrank", "frequency", "rank"];
    const rows: Record<string, string>[] = [];

    // Try simple word/entry/row elements first
    const wordEls = doc.querySelectorAll("word, entry, item, row, tr");
    if (wordEls.length > 0) {
      wordEls.forEach(el => {
        const row: Record<string, string> = {};
        // Try child elements as fields
        Array.from(el.children).forEach(child => {
          const key = child.tagName.toLowerCase().replace(/[^a-zа-я]/gi, "");
          row[key] = child.textContent?.trim() ?? "";
        });
        // Try attributes as fields
        Array.from(el.attributes).forEach(attr => {
          row[attr.name.toLowerCase()] = attr.value.trim();
        });
        if (Object.keys(row).length > 0) rows.push(row);
      });
      return rows;
    }

    // Fallback: look for any elements named like word fields
    const allEls = doc.getElementsByTagName("*");
    const current: Record<string, string> = {};
    Array.from(allEls).forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (knownFields.some(f => tag.includes(f)) && el.children.length === 0) {
        const key = knownFields.find(f => tag.includes(f)) ?? tag;
        current[key] = el.textContent?.trim() ?? "";
      }
    });
    if (Object.keys(current).length > 0) rows.push(current);
    return rows;
  } catch {
    return [];
  }
}

// Map CSV row to word input
function csvRowToWord(row: Record<string, string>) {
  // Accept various column name variants
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== "") return row[k];
    }
    return undefined;
  };
  const russian = get("russian", "ru", "рус", "русский");
  if (!russian) return null;
  const rankRaw = get("frequencyrank", "frequency", "rank", "ранг", "частотность");
  const frequencyRank = rankRaw ? parseInt(rankRaw, 10) : undefined;
  return {
    russian,
    polish: get("polish", "pl", "польский"),
    german: get("german", "de", "немецкий"),
    english: get("english", "en", "английский"),
    mnemonic: get("mnemonic", "hint", "подсказка", "мнемоника"),
    frequencyRank: isNaN(frequencyRank as number) ? undefined : frequencyRank,
  };
}

export default function Words() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<ListWordsSortBy>(ListWordsSortBy.frequency);
  const [filterType, setFilterType] = useState<string>("all");
  const [sortDifficult, setSortDifficult] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<Record<string, string>>>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [importMode, setImportMode] = useState<'file' | 'paste' | 'url'>('file');
  const [pasteText, setPasteText] = useState("");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: wordsData, isLoading } = useListWords({ 
    search: debouncedSearch || undefined, 
    sortBy 
  });

  const createWord = useCreateWord();
  const updateWord = useUpdateWord();
  const deleteWord = useDeleteWord();
  const bulkImportWords = useBulkImportWords();

  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [historyWordId, setHistoryWordId] = useState<number | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const { data: trashedWords } = useListTrashedWords({ query: { enabled: isTrashOpen } as never });
  const restoreWord = useRestoreWord();
  const { data: wordHistory } = useGetWordHistory(historyWordId ?? 0, { query: { enabled: historyWordId !== null } as never });

  const [formData, setFormData] = useState({
    russian: "",
    polish: "",
    german: "",
    english: "",
    mnemonic: "",
    frequencyRank: "",
    wordType: "" as string,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    const val = e.target.value;
    const timer = setTimeout(() => setDebouncedSearch(val), 250);
    return () => clearTimeout(timer);
  };

  const resetForm = () => {
    setFormData({ russian: "", polish: "", german: "", english: "", mnemonic: "", frequencyRank: "", wordType: "" });
    setEditingWord(null);
    setHistoryWordId(null);
  };

  const handleOpenAdd = () => { resetForm(); setIsAddOpen(true); };

  const handleOpenEdit = (word: Word) => {
    setFormData({
      russian: word.russian,
      polish: word.polish || "",
      german: word.german || "",
      english: word.english || "",
      mnemonic: word.mnemonic || "",
      frequencyRank: word.frequencyRank?.toString() || "",
      wordType: word.wordType || "",
    });
    setEditingWord(word);
    setHistoryWordId(word.id);
    setIsAddOpen(true);
  };

  const handleSaveWord = () => {
    if (!formData.russian.trim()) {
      toast({ title: "Ошибка", description: "Слово на русском обязательно", variant: "destructive" });
      return;
    }
    const payload = {
      russian: formData.russian.trim(),
      polish: formData.polish.trim() || undefined,
      german: formData.german.trim() || undefined,
      english: formData.english.trim() || undefined,
      mnemonic: formData.mnemonic.trim() || undefined,
      frequencyRank: formData.frequencyRank ? parseInt(formData.frequencyRank, 10) : undefined,
      wordType: (formData.wordType || undefined) as "academic" | "everyday" | "mixed" | undefined,
    };
    if (editingWord) {
      updateWord.mutate({ id: editingWord.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
          setIsAddOpen(false);
          toast({ title: "Слово обновлено" });
        }
      });
    } else {
      createWord.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
          setIsAddOpen(false);
          toast({ title: "Слово добавлено" });
        }
      });
    }
  };

  const handleDeleteWord = (id: number) => {
    if (confirm("Переместить в корзину?")) {
      deleteWord.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
          setIsAddOpen(false);
          toast({ title: "Слово перемещено в корзину" });
        }
      });
    }
  };

  const handleRestoreWord = (id: number) => {
    restoreWord.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
        toast({ title: "Слово восстановлено" });
      }
    });
  };

  const handleTranslate = async () => {
    const word = formData.russian.trim();
    if (!word) {
      toast({ title: "Введите слово на русском", variant: "destructive" });
      return;
    }
    setIsTranslating(true);
    try {
      const resp = await fetch("/api/words/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({ title: "Ошибка перевода", description: (err as any).error || resp.statusText, variant: "destructive" });
        return;
      }
      const data = await resp.json() as { polish?: string | null; german?: string | null; english?: string | null };
      setFormData(prev => ({
        ...prev,
        polish:  prev.polish  || data.polish  || "",
        german:  prev.german  || data.german  || "",
        english: prev.english || data.english || "",
      }));
      toast({ title: "Переводы получены", description: "Заполнены пустые поля. Проверьте и поправьте при необходимости." });
    } catch {
      toast({ title: "Сервис перевода недоступен", variant: "destructive" });
    } finally {
      setIsTranslating(false);
    }
  };

  const applyParsedRows = (rows: Record<string, string>[]) => {
    setCsvPreview(rows);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (ext === "xlsx" || ext === "xls" || ext === "ods") {
      // Excel / Google Sheets native format
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        const normalised = jsonRows.map(row => {
          const out: Record<string, string> = {};
          Object.entries(row).forEach(([k, v]) => {
            out[k.toLowerCase().replace(/\s+/g, "")] = String(v);
          });
          return out;
        });
        applyParsedRows(normalised);
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "xml") {
      const reader = new FileReader();
      reader.onload = (ev) => applyParsedRows(parseXml(ev.target?.result as string));
      reader.readAsText(file, "UTF-8");
    } else {
      // CSV / TSV / TXT
      const reader = new FileReader();
      reader.onload = (ev) => applyParsedRows(parseDelimited(ev.target?.result as string));
      reader.readAsText(file, "UTF-8");
    }
  };

  const handlePasteApply = () => {
    if (!pasteText.trim()) return;
    applyParsedRows(parseDelimited(pasteText));
  };

  const handleFetchUrl = async () => {
    if (!sheetsUrl.trim()) return;
    setIsFetchingUrl(true);
    try {
      // Server proxies the request (handles CORS and URL conversion)
      const encoded = encodeURIComponent(sheetsUrl.trim());
      const resp = await fetch(`/api/words/fetch-sheet?url=${encoded}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        toast({ title: "Ошибка загрузки", description: err.error || resp.statusText, variant: "destructive" });
        return;
      }
      const text = await resp.text();
      const rows = parseDelimited(text);
      if (rows.length === 0) {
        toast({ title: "Не удалось распознать данные", description: "Проверьте что таблица опубликована или ссылка открыта для всех", variant: "destructive" });
      } else {
        applyParsedRows(rows);
        setCsvFileName("Google Таблица");
      }
    } catch {
      toast({ title: "Ошибка сети", variant: "destructive" });
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const resetImport = () => {
    setCsvPreview([]);
    setCsvFileName("");
    setPasteText("");
    setSheetsUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleBulkImport = () => {
    if (csvPreview.length === 0) {
      toast({ title: "Нет данных", description: "Выберите файл, вставьте текст или укажите ссылку", variant: "destructive" });
      return;
    }
    const words = csvPreview.map(csvRowToWord).filter(Boolean) as NonNullable<ReturnType<typeof csvRowToWord>>[];
    if (words.length === 0) {
      toast({ title: "Нет валидных слов", description: "Убедитесь что есть колонка 'russian' (или 'ru', 'рус')", variant: "destructive" });
      return;
    }
    bulkImportWords.mutate({ data: { words } }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
        setIsBulkImportOpen(false);
        resetImport();
        toast({ 
          title: "Импорт завершён", 
          description: `Добавлено: ${result.imported}, Пропущено дубликатов: ${result.skipped}` 
        });
      },
      onError: () => toast({ title: "Ошибка сервера", variant: "destructive" })
    });
  };

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-foreground">Словарь</h1>
          {wordsData && (() => {
            const filtered = filterType === "all"
              ? wordsData.words.length
              : wordsData.words.filter(w =>
                  filterType === "none" ? !w.wordType : w.wordType === filterType
                ).length;
            const showFilter = filterType !== "all" || !!debouncedSearch;
            return (
              <span className="text-sm text-muted-foreground font-mono">
                {showFilter && filterType !== "all" ? `${filtered} / ` : ""}{wordsData.total} сл.
              </span>
            );
          })()}
        </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsTrashOpen(true)} className="text-muted-foreground" title="Корзина">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" title="Экспорт CSV" onClick={() => {
            const words = wordsData?.words ?? [];
            const header = "russian,polish,german,english,mnemonic,frequencyRank,wordType";
            const rows = words.map(w => [
              w.russian, w.polish ?? "", w.german ?? "", w.english ?? "",
              (w.mnemonic ?? "").replace(/,/g, ";"),
              w.frequencyRank ?? "", w.wordType ?? ""
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
            const csv = [header, ...rows].join("\n");
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `vocab-${new Date().toISOString().slice(0,10)}.csv`;
            a.click(); URL.revokeObjectURL(url);
          }}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsBulkImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Импорт
          </Button>
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-1.5" /> Добавить
          </Button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск..." 
            value={search}
            onChange={handleSearchChange}
            className="pl-9 pr-8"
            autoComplete="off"
          />
          {isLoading && search ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          ) : search ? (
            <button
              onClick={() => { setSearch(""); setDebouncedSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="sm:w-[150px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="academic">Академические</SelectItem>
            <SelectItem value="everyday">Бытовые</SelectItem>
            <SelectItem value="mixed">Смешанные</SelectItem>
            <SelectItem value="none">Без типа</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortDifficult ? "difficult" : sortBy}
          onValueChange={(val) => {
            if (val === "difficult") { setSortDifficult(true); }
            else { setSortDifficult(false); setSortBy(val as ListWordsSortBy); }
          }}
        >
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ListWordsSortBy.frequency}>По частотности</SelectItem>
            <SelectItem value={ListWordsSortBy.createdAt}>Сначала новые</SelectItem>
            <SelectItem value={ListWordsSortBy.russian}>По алфавиту (RU)</SelectItem>
            <SelectItem value="difficult">Сложные первыми</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (wordsData?.words.filter(w =>
            filterType === "all" ? true :
            filterType === "none" ? !w.wordType :
            w.wordType === filterType
          ).length === 0 && filterType !== "all") ? (
        <div className="text-center py-12 text-muted-foreground">Нет слов с этим типом</div>
      ) : wordsData?.words.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent text-center py-12">
          <CardContent className="space-y-4 pt-6">
            <p className="text-muted-foreground font-serif text-lg">Слова не найдены</p>
            <Button onClick={handleOpenAdd} variant="secondary">Создать первое слово</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(wordsData?.words ?? []).filter(w =>
            filterType === "all" ? true :
            filterType === "none" ? !w.wordType :
            w.wordType === filterType
          ).sort(sortDifficult
            ? (a, b) => ((b.hintCount ?? 0) - (b.correctCount ?? 0)) - ((a.hintCount ?? 0) - (a.correctCount ?? 0))
            : () => 0
          ).map(word => (
            <Card 
              key={word.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors bg-card/60 backdrop-blur-sm"
              onClick={() => handleOpenEdit(word)}
            >
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="overflow-hidden min-w-0 space-y-1">
                  {/* Single line: Russian — PL — DE — EN */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-bold text-base font-serif">{word.russian}</span>
                    <span className="text-muted-foreground/30 select-none">—</span>
                    <span className="text-sm text-muted-foreground">{word.polish || '—'}</span>
                    <span className="text-muted-foreground/30 select-none">—</span>
                    <span className="text-sm text-muted-foreground">{word.german || '—'}</span>
                    <span className="text-muted-foreground/30 select-none">—</span>
                    <span className="text-sm text-muted-foreground">{word.english || '—'}</span>
                    {word.frequencyRank && (
                      <Badge variant="secondary" className="text-[10px] text-muted-foreground/70 font-mono ml-1">
                        #{word.frequencyRank}
                      </Badge>
                    )}
                    {word.wordType && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground/60 ml-1">
                        {word.wordType === "academic" ? "акад" : word.wordType === "everyday" ? "быт" : "смеш"}
                      </Badge>
                    )}
                    {(word.hintCount ?? 0) >= 3 && (word.correctCount ?? 0) === 0 && (
                      <Badge variant="outline" className="text-[10px] text-destructive/70 border-destructive/30 ml-1">
                        сложное
                      </Badge>
                    )}
                  </div>
                  {/* Mnemonic below */}
                  {word.mnemonic && (
                    <p className="text-xs text-primary/60 italic truncate">{word.mnemonic}</p>
                  )}
                </div>
                <Edit2 className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit word dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[85svh] overflow-y-auto overscroll-y-contain p-5 top-[5%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]">
          <DialogHeader>
            <DialogTitle>{editingWord ? "Редактировать слово" : "Новое слово"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>Слово на русском <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input 
                  value={formData.russian} 
                  onChange={e => setFormData({ ...formData, russian: e.target.value })} 
                  placeholder="Например: дерево"
                  className="font-serif text-lg"
                  lang="ru"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-auto px-3"
                  onClick={handleTranslate}
                  disabled={isTranslating || !formData.russian.trim()}
                  title="Автоматически получить переводы"
                >
                  {isTranslating
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Languages className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Нажмите <Languages className="inline h-3 w-3 mx-0.5" /> чтобы получить переводы автоматически — проверьте и поправьте при необходимости.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Polski (PL)</Label>
                <Input 
                  value={formData.polish} 
                  onChange={e => setFormData({ ...formData, polish: e.target.value })}
                  lang="pl"
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Deutsch (DE)</Label>
                <Input 
                  value={formData.german} 
                  onChange={e => setFormData({ ...formData, german: e.target.value })}
                  lang="de"
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">English (EN)</Label>
                <Input 
                  value={formData.english} 
                  onChange={e => setFormData({ ...formData, english: e.target.value })}
                  lang="en"
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ваша подсказка / мнемоника</Label>
              <Textarea 
                value={formData.mnemonic} 
                onChange={e => setFormData({ ...formData, mnemonic: e.target.value })} 
                placeholder="Напишите свою подсказку для запоминания..."
                className="resize-none"
                rows={3}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-[11px] text-muted-foreground">Только вы пишете подсказку — она появится при нажатии кнопки «Подсказка» в тренажёре.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Частотность (ранг)</Label>
                <Input 
                  type="number" 
                  value={formData.frequencyRank} 
                  onChange={e => setFormData({ ...formData, frequencyRank: e.target.value })} 
                  placeholder="Например: 150"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Контекст</Label>
                <Select value={formData.wordType || "__none__"} onValueChange={v => setFormData({ ...formData, wordType: v === "__none__" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Не указан" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Не указан</SelectItem>
                    <SelectItem value="academic">Академическое</SelectItem>
                    <SelectItem value="everyday">Бытовое</SelectItem>
                    <SelectItem value="mixed">Смешанное</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Per-word analytics / history */}
            {editingWord && wordHistory && wordHistory.events.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> История ({wordHistory.events.length} событий)
                </p>
                <div className="rounded-lg border divide-y text-xs overflow-hidden">
                  {(() => {
                    const evts = wordHistory.events;
                    const correct = evts.filter(e => e.eventType === "correct" || e.eventType === "review_correct").length;
                    const wrong = evts.filter(e => e.eventType === "wrong" || e.eventType === "review_wrong").length;
                    const hints = evts.filter(e => e.eventType === "hint").length;
                    return (
                      <>
                        <div className="px-3 py-2 flex gap-4 text-muted-foreground">
                          <span>✅ {correct}</span>
                          <span>❌ {wrong}</span>
                          <span>💡 {hints}</span>
                        </div>
                        {evts.slice(0, 5).map(e => (
                          <div key={e.id} className="px-3 py-1.5 flex items-center justify-between">
                            <span className={
                              e.eventType === "correct" || e.eventType === "review_correct" ? "text-green-600" :
                              e.eventType === "wrong" || e.eventType === "review_wrong" ? "text-red-500" :
                              "text-muted-foreground"
                            }>
                              {e.eventType === "correct" ? "верно (новое)" :
                               e.eventType === "review_correct" ? "верно (повтор)" :
                               e.eventType === "wrong" ? "ошибка (новое)" :
                               e.eventType === "review_wrong" ? "ошибка (повтор)" :
                               "подсказка"}
                            </span>
                            <span className="text-muted-foreground">сессия {e.sessionNumber}</span>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center w-full pt-2 gap-2">
            {editingWord ? (
              <Button variant="destructive" size="icon" onClick={() => handleDeleteWord(editingWord.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
              <Button onClick={handleSaveWord} disabled={createWord.isPending || updateWord.isPending}>
                {(createWord.isPending || updateWord.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trash dialog */}
      <Dialog open={isTrashOpen} onOpenChange={setIsTrashOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[85svh] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Корзина
            </DialogTitle>
            <DialogDescription className="text-sm pt-1">
              Удалённые слова. Восстановите их в словарь или удалите навсегда.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            {(!trashedWords || trashedWords.words.length === 0) ? (
              <p className="text-muted-foreground text-sm text-center py-4">Корзина пуста</p>
            ) : (
              trashedWords.words.map(w => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <span className="font-bold font-serif">{w.russian}</span>
                    <span className="text-muted-foreground text-xs ml-2">{[w.polish, w.german, w.english].filter(Boolean).join(" · ")}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestoreWord(w.id)}
                    disabled={restoreWord.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Восстановить
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk import dialog — supports CSV, TSV, XLSX, XML, paste, and Google Sheets URL */}
      <Dialog open={isBulkImportOpen} onOpenChange={(open) => {
        setIsBulkImportOpen(open);
        if (!open) { resetImport(); setImportMode('file'); }
      }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Импорт слов
            </DialogTitle>
          </DialogHeader>

          {/* Mode tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 mt-1">
            {([['file', 'Файл'], ['paste', 'Вставить'], ['url', 'Ссылка']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => { setImportMode(mode); resetImport(); }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${importMode === mode ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="py-2 space-y-4">

            {/* FILE MODE */}
            {importMode === 'file' && (
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls,.ods,.xml,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {csvFileName ? (
                  <div className="space-y-1">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                    <p className="font-medium text-sm">{csvFileName}</p>
                    <p className="text-muted-foreground text-xs">{csvPreview.length} строк</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium">Нажмите чтобы выбрать файл</p>
                    <p className="text-muted-foreground text-xs">CSV · TSV · XLSX · XML</p>
                  </div>
                )}
              </div>
            )}

            {/* PASTE MODE */}
            {importMode === 'paste' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Скопируйте ячейки из Google Таблицы и вставьте сюда. Первая строка — заголовки: <code className="bg-muted px-1 rounded">russian, polish, german, english</code>
                </p>
                <Textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={"russian\tpolish\tgerman\tenglish\nяблоко\tjabłko\tApfel\tapple"}
                  rows={6}
                  className="font-mono text-xs resize-none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Button size="sm" variant="outline" className="w-full" onClick={handlePasteApply} disabled={!pasteText.trim()}>
                  <ClipboardPaste className="h-4 w-4 mr-1.5" /> Распознать
                </Button>
              </div>
            )}

            {/* URL MODE */}
            {importMode === 'url' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Вставьте ссылку на Google Таблицу (должна быть открыта для всех по ссылке).
                </p>
                <div className="flex gap-2">
                  <Input
                    value={sheetsUrl}
                    onChange={e => setSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="text-xs"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <Button size="sm" onClick={handleFetchUrl} disabled={isFetchingUrl || !sheetsUrl.trim()}>
                    {isFetchingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Preview */}
            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Предпросмотр</p>
                <div className="rounded-lg border overflow-hidden text-xs">
                  {csvPreview.slice(0, 4).map((row, i) => {
                    const word = csvRowToWord(row);
                    if (!word) return null;
                    return (
                      <div key={i} className="px-3 py-2 border-b last:border-0">
                        <span className="font-bold font-serif">{word.russian}</span>
                        <span className="text-muted-foreground ml-2">
                          {[word.polish, word.german, word.english].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    );
                  })}
                  {csvPreview.length > 4 && (
                    <div className="px-3 py-1.5 text-muted-foreground">…ещё {csvPreview.length - 4} строк</div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Найдено слов: <strong>{csvPreview.map(csvRowToWord).filter(Boolean).length}</strong>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" onClick={() => setIsBulkImportOpen(false)}>Отмена</Button>
            <Button
              onClick={handleBulkImport}
              disabled={bulkImportWords.isPending || csvPreview.length === 0}
            >
              {bulkImportWords.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : `Импортировать ${csvPreview.map(csvRowToWord).filter(Boolean).length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
