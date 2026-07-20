import { useGetDueReviews } from "@workspace/api-client-react";
import { Trainer } from "@/components/trainer";
import { Loader2 } from "lucide-react";

export default function Review() {
  const { data: session, isLoading } = useGetDueReviews();

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  return <Trainer words={session.words} title="Повторение" />;
}
