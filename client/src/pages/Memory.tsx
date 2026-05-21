import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type Memory as MemoryItem } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2Icon } from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Memory() {
  const queryClient = useQueryClient();
  const api = useApi();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: memories = [] } = useQuery<MemoryItem[]>({
    queryKey: ["memories"],
    queryFn: api.getMemories,
  });

  async function handleDelete() {
    if (!confirmId) return;
    setDeleting(true);
    try {
      await api.deleteMemory(confirmId);
      await queryClient.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Memory deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader navLink={{ to: "/", label: "Chat" }} />

      <main className="flex-1 overflow-y-auto p-6">
        <h1 className="font-heading mb-6 text-xl font-semibold">Memories</h1>

        {memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No memories yet.</p>
        ) : (
          <ul className="space-y-3">
            {memories.map((mem) => (
              <li key={mem.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-4 pt-4">
                    <div className="flex-1">
                      <p className="text-sm">{mem.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(mem.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setConfirmId(mem.id)}
                      aria-label="Delete memory"
                    >
                      <Trash2Icon />
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={confirmId !== null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete memory?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The memory will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
