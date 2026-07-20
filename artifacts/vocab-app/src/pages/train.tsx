import { useGetTrainingSession } from "@workspace/api-client-react";
import { Trainer } from "@/components/trainer";
import { Loader2 } from "lucide-react";

export default function Train() {
  const { data: session, isLoading } = useGetTrainingSession();

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  return <Trainer words={session.words} title="Ежедневная Тренировка" />;
}
