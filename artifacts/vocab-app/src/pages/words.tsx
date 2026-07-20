import { useState } from "react";
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
import { Loader2, Search, Plus, Trash2, Import, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Words() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<ListWordsSortBy>(ListWordsSortBy.frequency);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  
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

  const [bulkImportText, setBulkImportText] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    const timer = setTimeout(() => {
      setDebouncedSearch(e.target.value);
    }, 500);
    return () => clearTimeout(timer);
  };

  const resetForm = () => {
    setFormData({
      russian: "", polish: "", german: "", english: "", mnemonic: "", frequencyRank: "",
    });
    setEditingWord(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

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

  const handleBulkImport = () => {
    try {
      const parsed = JSON.parse(bulkImportText);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      
      bulkImportWords.mutate({ data: { words: parsed } }, {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
          setIsBulkImportOpen(false);
          setBulkImportText("");
          toast({ 
            title: "Импорт завершен", 
            description: `Добавлено: ${result.imported}, Пропущено: ${result.skipped}` 
          });
        },
        onError: () => {
          toast({ title: "Ошибка сервера", variant: "destructive" });
        }
      });
    } catch {
      toast({ title: "Ошибка формата", description: "Ожидается валидный JSON массив", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Словарь</h1>
          <p className="text-muted-foreground text-sm">Ваша личная база знаний.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsBulkImportOpen(true)}>
            <Import className="h-4 w-4 mr-2" /> Импорт
          </Button>
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-2" /> Добавить
          </Button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск по словам и переводам..." 
            value={search}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(val: ListWordsSortBy) => setSortBy(val)}>
          <SelectTrigger className="w-[180px]">
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
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg font-serif">{word.russian}</span>
                    {word.frequencyRank && (
                      <Badge variant="secondary" className="text-[10px] uppercase text-muted-foreground/80 font-mono">
                        #{word.frequencyRank}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex gap-3 truncate">
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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWord ? "Редактировать слово" : "Новое слово"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Слово на русском <span className="text-destructive">*</span></Label>
              <Input 
                value={formData.russian} 
                onChange={e => setFormData({ ...formData, russian: e.target.value })} 
                placeholder="Например: дерево"
                className="font-serif text-lg"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Polski</Label>
                <Input value={formData.polish} onChange={e => setFormData({ ...formData, polish: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Deutsch</Label>
                <Input value={formData.german} onChange={e => setFormData({ ...formData, german: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">English</Label>
                <Input value={formData.english} onChange={e => setFormData({ ...formData, english: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Подсказка / Мнемоника</Label>
              <Textarea 
                value={formData.mnemonic} 
                onChange={e => setFormData({ ...formData, mnemonic: e.target.value })} 
                placeholder="Как легко запомнить это слово?"
                className="resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Частотность (ранг)</Label>
              <Input 
                type="number" 
                value={formData.frequencyRank} 
                onChange={e => setFormData({ ...formData, frequencyRank: e.target.value })} 
                placeholder="Например: 150"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
            {editingWord ? (
              <Button variant="destructive" size="icon" onClick={() => handleDeleteWord(editingWord.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : <div></div>}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
              <Button onClick={handleSaveWord} disabled={createWord.isPending || updateWord.isPending}>
                {(createWord.isPending || updateWord.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Массовый импорт JSON</DialogTitle>
            <DialogDescription>
              Вставьте массив объектов JSON со свойствами: russian, polish, german, english.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              value={bulkImportText} 
              onChange={e => setBulkImportText(e.target.value)} 
              placeholder={'[\n  { "russian": "кот", "english": "cat", "german": "Katze", "polish": "kot" }\n]'}
              className="font-mono text-xs h-64 bg-muted/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(false)}>Отмена</Button>
            <Button onClick={handleBulkImport} disabled={bulkImportWords.isPending}>
              {bulkImportWords.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Импортировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
