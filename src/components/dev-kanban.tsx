import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, GripVertical, ExternalLink } from "lucide-react";

import { listSubtickets, updateSubticketStatus, getSubticket } from "@/lib/subtickets.functions";
import { devStatusLabels, type DevStatus } from "@/lib/subtickets-support";
import { PriorityBadge } from "@/lib/priority-badge";
import { RelativeTime } from "@/lib/relative-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLUMNS: DevStatus[] = ["backlog", "em_desenvolvimento", "aguardando_deploy", "concluido"];

const columnAccent: Record<DevStatus, string> = {
  backlog: "bg-muted text-muted-foreground",
  em_desenvolvimento: "bg-primary/10 text-primary",
  aguardando_deploy: "bg-accent/15 text-accent-foreground",
  concluido: "bg-secondary text-secondary-foreground",
};

type Subticket = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status_dev: DevStatus | null;
  parent_ticket_id: string;
  display_number: string | null;
  created_at: string;
};

export const subticketsQuery = queryOptions({
  queryKey: ["subtickets"],
  queryFn: () => listSubtickets({ data: {} }) as Promise<Subticket[]>,
});

function parentNumber(displayNumber: string | null | undefined) {
  return (displayNumber ?? "").split(".")[0] || "—";
}

function SubticketCard({
  ticket,
  onOpen,
  dragging,
}: {
  ticket: Subticket;
  onOpen?: (id: string) => void;
  dragging?: boolean;
}) {
  return (
    <Card className={dragging ? "shadow-lg" : ""}>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="text-left text-sm font-medium hover:underline"
            onClick={() => onOpen?.(ticket.id)}
          >
            {ticket.title}
          </button>
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {ticket.display_number ?? "—"}
          </Badge>
          <PriorityBadge priority={ticket.priority as any} />
        </div>
        <Link
          to="/portal/chamado/$id"
          params={{ id: ticket.parent_ticket_id }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" /> Chamado {parentNumber(ticket.display_number)}
        </Link>
      </CardContent>
    </Card>
  );
}

function DraggableCard({ ticket, onOpen }: { ticket: Subticket; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      className="touch-none"
    >
      <SubticketCard ticket={ticket} onOpen={onOpen} />
    </div>
  );
}

function Column({
  status,
  tickets,
  onOpen,
}: {
  status: DevStatus;
  tickets: Subticket[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg border p-3 transition-colors ${
        isOver ? "border-primary bg-primary/5" : "bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{devStatusLabels[status]}</span>
        <Badge className={columnAccent[status]} variant="secondary">
          {tickets.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {tickets.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhum subchamado
          </p>
        ) : (
          tickets.map((t) => <DraggableCard key={t.id} ticket={t} onOpen={onOpen} />)
        )}
      </div>
    </div>
  );
}

function SubticketDetail({
  id,
  onClose,
  onStatusChange,
}: {
  id: string | null;
  onClose: () => void;
  onStatusChange: (id: string, status: DevStatus) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["subticket", id],
    queryFn: () => getSubticket({ data: { id: id as string } }),
    enabled: Boolean(id),
  });

  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {isLoading || !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {data.ticket.display_number ?? "—"}
                </Badge>
                {data.ticket.title}
              </DialogTitle>
              <DialogDescription>
                <Link
                  to="/portal/chamado/$id"
                  params={{ id: data.ticket.parent_ticket_id as string }}
                  className="underline"
                >
                  Abrir chamado {parentNumber(data.ticket.display_number)}
                </Link>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <p className="whitespace-pre-wrap text-sm">{data.ticket.description}</p>

              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label>Prioridade</Label>
                  <div>
                    <PriorityBadge priority={data.ticket.priority as any} />
                  </div>
                </div>
                <div className="min-w-52 space-y-1">
                  <Label>Situação de desenvolvimento</Label>
                  <Select
                    value={(data.ticket.status_dev as DevStatus) ?? "backlog"}
                    onValueChange={(v) => onStatusChange(data.ticket.id as string, v as DevStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {devStatusLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Histórico</Label>
                {data.updates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem registros.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.updates.map((u: any) => (
                      <li key={u.id} className="rounded-md border p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{u.author_name}</span>
                          <RelativeTime value={u.created_at} />
                        </div>
                        <p className="whitespace-pre-wrap">{u.message ?? "—"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DevKanban() {
  const queryClient = useQueryClient();
  const { data: tickets = [], isLoading } = useQuery(subticketsQuery);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const updateStatus = useServerFn(updateSubticketStatus);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status_dev: DevStatus }) => updateStatus({ data: vars }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["subtickets"] });
      const previous = queryClient.getQueryData<Subticket[]>(["subtickets"]);
      queryClient.setQueryData<Subticket[]>(["subtickets"], (old) =>
        (old ?? []).map((t) => (t.id === vars.id ? { ...t, status_dev: vars.status_dev } : t)),
      );
      return { previous };
    },
    onError: (error: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["subtickets"], ctx.previous);
      toast.error(error?.message ?? "Não foi possível mover o subchamado");
    },
    onSuccess: (_data, vars) => {
      toast.success(`Movido para ${devStatusLabels[vars.status_dev]}`);
    },
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: ["subtickets"] });
      queryClient.invalidateQueries({ queryKey: ["subticket", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["all-tickets"] });
      const parentId = tickets.find((t) => t.id === vars.id)?.parent_ticket_id;
      if (parentId) queryClient.invalidateQueries({ queryKey: ["ticket", parentId] });
    },
  });

  const byStatus = useMemo(() => {
    const map: Record<DevStatus, Subticket[]> = {
      backlog: [],
      em_desenvolvimento: [],
      aguardando_deploy: [],
      concluido: [],
    };
    for (const t of tickets) {
      const status = (t.status_dev ?? "backlog") as DevStatus;
      (map[status] ?? map.backlog).push(t);
    }
    return map;
  }, [tickets]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const over = event.over?.id as DevStatus | undefined;
    if (!over) return;
    const ticket = tickets.find((t) => t.id === event.active.id);
    if (!ticket || (ticket.status_dev ?? "backlog") === over) return;
    mutation.mutate({ id: ticket.id, status_dev: over });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const activeTicket = tickets.find((t) => t.id === activeId) ?? null;

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((status) => (
            <Column key={status} status={status} tickets={byStatus[status]} onOpen={setOpenId} />
          ))}
        </div>
        <DragOverlay>
          {activeTicket ? <SubticketCard ticket={activeTicket} dragging /> : null}
        </DragOverlay>
      </DndContext>

      <SubticketDetail
        id={openId}
        onClose={() => setOpenId(null)}
        onStatusChange={(id, status) => mutation.mutate({ id, status_dev: status })}
      />
    </>
  );
}
