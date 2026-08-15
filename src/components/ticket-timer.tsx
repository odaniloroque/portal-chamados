import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { createTimeEntry } from "@/lib/time-entries.functions";
import { formatClock, todayISO } from "@/lib/time-format";

const key = (ticketId: string) => `projetus:timer:${ticketId}`;

export function TicketTimer({ ticketId, clientId }: { ticketId: string; clientId: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createTimeEntry);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(key(ticketId));
    if (stored) setStartedAt(Number(stored));
  }, [ticketId]);

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  function start() {
    const ts = Date.now();
    localStorage.setItem(key(ticketId), String(ts));
    setStartedAt(ts);
    setNow(ts);
  }

  async function stop() {
    if (!startedAt) return;
    const end = Date.now();
    const minutes = Math.max(1, Math.round((end - startedAt) / 60000));
    setSaving(true);
    try {
      await create({
        data: {
          client_id: clientId,
          ticket_id: ticketId,
          description: description.trim(),
          entry_date: todayISO(),
          started_at: new Date(startedAt).toISOString(),
          ended_at: new Date(end).toISOString(),
          duration_minutes: minutes,
          source: "timer",
        },
      });
      localStorage.removeItem(key(ticketId));
      setStartedAt(null);
      setDescription("");
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success(`Registrado ${minutes} min neste chamado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar as horas");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="h-4 w-4 text-primary" /> Horas trabalhadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-3xl tabular-nums">{formatClock(elapsed)}</span>
          {startedAt === null ? (
            <Button onClick={start}>
              <Play className="mr-2 h-4 w-4" /> Iniciar
            </Button>
          ) : (
            <Button variant="destructive" onClick={stop} disabled={saving}>
              <Square className="mr-2 h-4 w-4" /> Parar e registrar
            </Button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Descrição do atendimento</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: atendimento remoto — ajuste de configuração"
            maxLength={400}
          />
        </div>
      </CardContent>
    </Card>
  );
}
