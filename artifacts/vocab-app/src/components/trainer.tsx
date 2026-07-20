import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Check, Lightbulb, X, ArrowRight, BookOpen } from "lucide-react";
import { 
  useSubmitAnswer, 
  useRequestHint, 
  TrainingWord,
  useGetSettings,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type TrainerProps = {
  words: TrainingWord[];
  title: string;
  onFinish?: () => void;
};

type QueueItem = TrainingWord & {
  isRepeat?: boolean;
};

type FieldState = 'idle' | 'correct' | 'wrong';

export function Trainer({ words: initialWords, title, onFinish }: TrainerProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const { data: settings } = useGetSettings();

  const [pl, setPl] = useState("");
  const [de, setDe] = useState("");
  const [en, setEn] = useState("");

  const [plState, setPlState] = useState<FieldState>('idle');
  const [deState, setDeState] = useState<FieldState>('idle');
  const [enState, setEnState] = useState<FieldState>('idle');

  const [hintData, setHintData] = useState<{
    mnemonic?: string | null;
    polish?: string | null;
    german?: string | null;
    english?: string | null;
  } | null>(null);

  const [showNext, setShowNext] = useState(false);
  const [isSuccessShake, setIsSuccessShake] = useState(false);
  
  const submitAnswer = useSubmitAnswer();
  const requestHint = useRequestHint();

  const inputRefs = {
    pl: useRef<HTMLInputElement>(null),
    de: useRef<HTMLInputElement>(null),
    en: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (initialWords.length > 0) {
      setQueue(initialWords);
      setCurrentIndex(0);
      setCompletedCount(0);
      setHintsUsed(0);
      setSessionFinished(false);
      resetWordState();
    }
  }, [initialWords]);

  const resetWordState = () => {
    setPl("");
    setDe("");
    setEn("");
    setPlState('idle');
    setDeState('idle');
    setEnState('idle');
    setHintData(null);
    setShowNext(false);
    setIsSuccessShake(false);
    // Focus first input slightly after render
    setTimeout(() => {
      inputRefs.pl.current?.focus();
    }, 50);
  };

  const handleHint = () => {
    const currentWord = queue[currentIndex];
    if (!currentWord) return;

    requestHint.mutate({ data: { wordId: currentWord.wordId } }, {
      onSuccess: (data) => {
        setHintData({
          mnemonic: data.mnemonic,
          polish: data.polish,
          german: data.german,
          english: data.english,
        });
        setHintsUsed(prev => prev + 1);
      }
    });
  };

  const handleCheck = () => {
    const currentWord = queue[currentIndex];
    if (!currentWord) return;

    submitAnswer.mutate({
      data: {
        wordId: currentWord.wordId,
        polish: pl.trim(),
        german: de.trim(),
        english: en.trim()
      }
    }, {
      onSuccess: (result) => {
        setPlState(result.polishCorrect ? 'correct' : 'wrong');
        setDeState(result.germanCorrect ? 'correct' : 'wrong');
        setEnState(result.englishCorrect ? 'correct' : 'wrong');

        if (result.allCorrect) {
          setIsSuccessShake(true);
          setCompletedCount(prev => prev + 1);
          setTimeout(() => {
            advanceNext();
          }, 1000);
        } else {
          setShowNext(true);
          // Re-queue logic
          const errorRepeatAfter = settings?.errorRepeatAfter || 3;
          const insertIndex = Math.min(currentIndex + errorRepeatAfter + 1, queue.length);
          const newQueue = [...queue];
          newQueue.splice(insertIndex, 0, { ...currentWord, isRepeat: true });
          setQueue(newQueue);
        }
      }
    });
  };

  const advanceNext = () => {
    if (currentIndex + 1 >= queue.length) {
      setSessionFinished(true);
      if (onFinish) onFinish();
    } else {
      setCurrentIndex(prev => prev + 1);
      resetWordState();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextField: 'de' | 'en' | 'submit') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextField === 'submit') {
        if (showNext) {
          advanceNext();
        } else {
          handleCheck();
        }
      } else {
        inputRefs[nextField].current?.focus();
      }
    }
  };

  if (initialWords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="p-6 bg-secondary/50 rounded-full text-primary">
          <BookOpen className="h-12 w-12" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold font-serif">Нет слов для тренировки</h2>
          <p className="text-muted-foreground">Вы можете добавить новые слова в словаре или отдохнуть.</p>
        </div>
        <Link href="/words">
          <Button>Перейти в Словарь</Button>
        </Link>
      </div>
    );
  }

  if (sessionFinished) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="p-6 bg-primary/10 rounded-full text-primary">
          <Check className="h-12 w-12" />
        </div>
        <h2 className="text-3xl font-bold font-serif text-primary">Отличная работа!</h2>
        <div className="flex items-center gap-6 text-lg">
          <div className="flex flex-col items-center text-primary">
            <span className="font-bold text-2xl">{completedCount}</span>
            <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Слов</span>
          </div>
          <div className="w-px h-10 bg-border"></div>
          <div className="flex flex-col items-center text-muted-foreground">
            <span className="font-bold text-2xl">{hintsUsed}</span>
            <span className="text-sm uppercase tracking-wider font-semibold">Подсказок</span>
          </div>
        </div>
        <Link href="/">
          <Button size="lg" className="mt-4">На главную</Button>
        </Link>
      </div>
    );
  }

  const currentWord = queue[currentIndex];
  if (!currentWord) return null;

  const totalOriginalWords = initialWords.length;
  // Progress based on completed distinct original words.
  // Actually simpler: just completedCount vs totalOriginalWords (if completedCount can exceed, cap it)
  const progressPercent = Math.min((completedCount / totalOriginalWords) * 100, 100);

  return (
    <div className="max-w-xl mx-auto flex flex-col min-h-[80vh]">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-serif text-muted-foreground">{title}</h1>
        <div className="flex items-center gap-4 text-sm font-semibold bg-secondary/50 px-4 py-2 rounded-full">
          <span className="text-primary flex items-center gap-1"><Check className="h-4 w-4" /> {completedCount} / {totalOriginalWords}</span>
          <span className="text-muted-foreground flex items-center gap-1"><Lightbulb className="h-4 w-4" /> {hintsUsed}</span>
        </div>
      </div>

      <Progress value={progressPercent} className="h-2 mb-10" />

      <div className="flex-1 flex flex-col">
        <div className="text-center mb-10 relative">
          {currentWord.isRepeat && (
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-full animate-in fade-in slide-in-from-bottom-2">
              Повторение ошибки
            </span>
          )}
          <h2 className="text-4xl md:text-5xl font-bold font-serif tracking-tight text-foreground">
            {currentWord.russian}
          </h2>
        </div>

        {hintData && (
          <div className="mb-8 p-4 bg-primary/5 rounded-xl border border-primary/10 animate-in fade-in slide-in-from-top-4">
            {hintData.mnemonic && (
              <p className="text-sm text-primary mb-3 font-medium italic">"{hintData.mnemonic}"</p>
            )}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs uppercase block mb-1">PL</span>
                <span className="font-semibold">{hintData.polish || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase block mb-1">DE</span>
                <span className="font-semibold">{hintData.german || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase block mb-1">EN</span>
                <span className="font-semibold">{hintData.english || '—'}</span>
              </div>
            </div>
          </div>
        )}

        <div className={cn("space-y-4 mb-8", isSuccessShake ? "success-pulse" : "")}>
          <div className="grid gap-2">
            <Label htmlFor="pl" className="text-xs uppercase text-muted-foreground ml-1 font-bold tracking-wider">Polski (PL)</Label>
            <Input
              id="pl"
              ref={inputRefs.pl}
              value={pl}
              onChange={(e) => setPl(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'de')}
              disabled={showNext || isSuccessShake}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className={cn(
                "text-lg h-14 bg-card",
                plState === 'correct' && "border-green-500 bg-green-50/50 text-green-700 dark:bg-green-950/20 dark:text-green-400 focus-visible:ring-green-500",
                plState === 'wrong' && "border-red-500 bg-red-50/50 text-red-700 dark:bg-red-950/20 dark:text-red-400 shake focus-visible:ring-red-500"
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="de" className="text-xs uppercase text-muted-foreground ml-1 font-bold tracking-wider">Deutsch (DE)</Label>
            <Input
              id="de"
              ref={inputRefs.de}
              value={de}
              onChange={(e) => setDe(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'en')}
              disabled={showNext || isSuccessShake}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className={cn(
                "text-lg h-14 bg-card",
                deState === 'correct' && "border-green-500 bg-green-50/50 text-green-700 dark:bg-green-950/20 dark:text-green-400 focus-visible:ring-green-500",
                deState === 'wrong' && "border-red-500 bg-red-50/50 text-red-700 dark:bg-red-950/20 dark:text-red-400 shake focus-visible:ring-red-500"
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="en" className="text-xs uppercase text-muted-foreground ml-1 font-bold tracking-wider">English (EN)</Label>
            <Input
              id="en"
              ref={inputRefs.en}
              value={en}
              onChange={(e) => setEn(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'submit')}
              disabled={showNext || isSuccessShake}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className={cn(
                "text-lg h-14 bg-card",
                enState === 'correct' && "border-green-500 bg-green-50/50 text-green-700 dark:bg-green-950/20 dark:text-green-400 focus-visible:ring-green-500",
                enState === 'wrong' && "border-red-500 bg-red-50/50 text-red-700 dark:bg-red-950/20 dark:text-red-400 shake focus-visible:ring-red-500"
              )}
            />
          </div>
        </div>

        <div className="mt-auto space-y-3 pb-4">
          {showNext ? (
            <Button 
              size="lg" 
              className="w-full h-14 text-lg" 
              onClick={advanceNext}
              autoFocus
            >
              Следующее <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <>
              <Button 
                size="lg" 
                className="w-full h-14 text-lg" 
                onClick={handleCheck}
                disabled={isSuccessShake || (!pl && !de && !en)}
              >
                Проверить
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className={cn("w-full h-14", hintData ? "border-primary/50 text-primary" : "text-muted-foreground")}
                onClick={handleHint}
                disabled={isSuccessShake || hintData !== null}
              >
                <Lightbulb className="mr-2 h-5 w-5" />
                Подсказка
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
