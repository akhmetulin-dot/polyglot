import { useState, useRef } from "react";
import { 
  useListWords, 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, Plus, Trash2, Upload, Edit2, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Minimal CSV parser: handles quoted fields, comma-separated
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ""));
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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<Record<string, string>>>([]);
  const [csvFileName, setCsvFileName] = useState("");
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

  const [formData, setFormData] = useState({
    russian: "",
    polish: "",
    german: "",
    english: "",
    mnemonic: "",
    frequencyRank: "",
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    const val = e.target.value;
    const timer = setTimeout(() => setDebouncedSearch(val), 400);
    return () => clearTimeout(timer);
  };

  const resetForm = () => {
    setFormData({ russian: "", polish: "", german: "", english: "", mnemonic: "", frequencyRank: "" });
    setEditingWord(null);
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
    });
    setEditingWord(word);
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
    if (confirm("Удалить это слово?")) {
      deleteWord.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
          setIsAddOpen(false);
          toast({ title: "Слово удалено" });
        }
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setCsvPreview(rows);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleBulkImport = () => {
    if (csvPreview.length === 0) {
      toast({ title: "Нет данных", description: "Выберите CSV файл", variant: "destructive" });
      return;
    }
    const words = csvPreview.map(csvRowToWord).filter(Boolean) as NonNullable<ReturnType<typeof csvRowToWord>>[];
    if (words.length === 0) {
      toast({ title: "Нет валидных слов", description: "Убедитесь что в файле есть колонка 'russian'", variant: "destructive" });
      return;
    }
    bulkImportWords.mutate({ data: { words } }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
        setIsBulkImportOpen(false);
        setCsvPreview([]);
        setCsvFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast({ 
          title: "Импорт завершён", 
          description: `Добавлено: ${result.imported}, Пропущено: ${result.skipped}` 
        });
      },
      onError: () => toast({ title: "Ошибка сервера", variant: "destructive" })
    });
  };

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-foreground">Словарь</h1>
          <p className="text-muted-foreground text-sm">Ваша личная база знаний.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsBulkImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Импорт CSV
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
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <Select value={sortBy} onValueChange={(val: ListWordsSortBy) => setSortBy(val)}>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ListWordsSortBy.frequency}>По частотности</SelectItem>
            <SelectItem value={ListWordsSortBy.createdAt}>Сначала новые</SelectItem>
            <SelectItem value={ListWordsSortBy.russian}>По алфавиту (RU)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : wordsData?.words.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent text-center py-12">
          <CardContent className="space-y-4 pt-6">
            <p className="text-muted-foreground font-serif text-lg">Слова не найдены</p>
            <Button onClick={handleOpenAdd} variant="secondary">Создать первое слово</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {wordsData?.words.map(word => (
            <Card 
              key={word.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors bg-card/60 backdrop-blur-sm"
              onClick={() => handleOpenEdit(word)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1 overflow-hidden min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg font-serif">{word.russian}</span>
                    {word.frequencyRank && (
                      <Badge variant="secondary" className="text-[10px] uppercase text-muted-foreground/80 font-mono">
                        #{word.frequencyRank}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    {word.polish && <span><span className="text-[10px] uppercase font-bold mr-1">PL</span>{word.polish}</span>}
                    {word.german && <span><span className="text-[10px] uppercase font-bold mr-1">DE</span>{word.german}</span>}
                    {word.english && <span><span className="text-[10px] uppercase font-bold mr-1">EN</span>{word.english}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">
                    <span className="text-green-600 dark:text-green-500 font-bold">{word.correctCount}</span>
                    <span className="opacity-50 mx-1">/</span>
                    <span className="text-amber-600 dark:text-amber-500 font-bold">{word.hintCount}</span>
                  </div>
                  <Edit2 className="h-4 w-4 text-muted-foreground/30 mt-2 ml-auto" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit word dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle>{editingWord ? "Редактировать слово" : "Новое слово"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>Слово на русском <span className="text-destructive">*</span></Label>
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
              />
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

            <div className="space-y-1.5">
              <Label>Частотность (ранг в академическом словаре)</Label>
              <Input 
                type="number" 
                value={formData.frequencyRank} 
                onChange={e => setFormData({ ...formData, frequencyRank: e.target.value })} 
                placeholder="Например: 150"
                autoComplete="off"
              />
            </div>
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

      {/* Bulk CSV import dialog */}
      <Dialog open={isBulkImportOpen} onOpenChange={(open) => {
        setIsBulkImportOpen(open);
        if (!open) { setCsvPreview([]); setCsvFileName(""); if (fileInputRef.current) fileInputRef.current.value = ""; }
      }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Импорт из Google Таблицы
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-1">
              Откройте таблицу в Google Sheets → Файл → Скачать → CSV. Колонки: <code className="bg-muted px-1 rounded text-xs">russian, polish, german, english, mnemonic, frequencyRank</code>. Первая строка — заголовки.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/plain"
                className="hidden"
                onChange={handleFileChange}
              />
              {csvFileName ? (
                <div className="space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                  <p className="font-medium text-sm">{csvFileName}</p>
                  <p className="text-muted-foreground text-xs">{csvPreview.length} строк найдено</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium">Нажмите чтобы выбрать CSV файл</p>
                  <p className="text-muted-foreground text-xs">Экспортируйте из Google Таблицы как CSV</p>
                </div>
              )}
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Предпросмотр (первые 3 строки)</p>
                <div className="rounded-lg border overflow-hidden text-xs">
                  {csvPreview.slice(0, 3).map((row, i) => {
                    const word = csvRowToWord(row);
                    if (!word) return null;
                    return (
                      <div key={i} className="px-3 py-2 border-b last:border-0 space-y-0.5">
                        <span className="font-bold font-serif">{word.russian}</span>
                        <div className="text-muted-foreground flex flex-wrap gap-x-2">
                          {word.polish && <span>PL: {word.polish}</span>}
                          {word.german && <span>DE: {word.german}</span>}
                          {word.english && <span>EN: {word.english}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Будет импортировано: {csvPreview.map(csvRowToWord).filter(Boolean).length} слов
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
              {bulkImportWords.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Импортировать ${csvPreview.map(csvRowToWord).filter(Boolean).length} слов`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
