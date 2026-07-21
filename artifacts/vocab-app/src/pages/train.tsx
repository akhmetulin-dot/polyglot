import { useGetTrainingSession } from "@workspace/api-client-react";
import { Trainer } from "@/components/trainer";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export default function Train() {
  const { data: session, isLoading } = useGetTrainingSession();

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
          <BookOpen className="h-12 w-12" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold font-serif">Нет слов для теста</h2>
          <p className="text-muted-foreground">Сначала изучите слова в Прописях — потом приходите на тест.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/trace"><Button variant="outline">✏️ Прописи</Button></Link>
          <Link href="/"><Button>Главная</Button></Link>
        </div>
      </div>
    );
  }

  return <Trainer words={session.words} title="Тест" />;
}
