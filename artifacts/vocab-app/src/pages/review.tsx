import { useGetDueReviews } from "@workspace/api-client-react";
import { Trainer } from "@/components/trainer";
import { Loader2, Clock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Review() {
  const { data: session, isLoading } = useGetDueReviews();

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || session.words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="p-6 bg-secondary/50 rounded-full text-primary">
          <Clock className="h-12 w-12" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold font-serif">Нет слов для повторения</h2>
          <p className="text-muted-foreground">Всё повторено! Возвращайтесь позже или продолжайте изучать новые слова.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/train"><Button variant="outline">Тренировка</Button></Link>
          <Link href="/"><Button>Главная</Button></Link>
        </div>
      </div>
    );
  }

  return <Trainer words={session.words} title="Повторение" />;
}
