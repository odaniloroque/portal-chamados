import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

import { createSubticket, listSubtickets } from "@/lib/subtickets.functions";
import { devStatusLabels, devStatusSchema, type DevStatus } from "@/lib/subtickets-support";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  title: z.string().trim().min(3, "Informe um título com ao menos 3 caracteres").max(150),
  description: z.string().trim().min(5, "Descreva a demanda").max(4000),
  priority: z.enum(["baixa", "media", "alta", "critica"]),
  status_dev: devStatusSchema,
});

type FormValues = z.infer<typeof formSchema>;

const priorityLabels: Record<FormValues["priority"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export function NewSubticketDialog({ parentTicketId }: { parentTicketId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const create = useServerFn(createSubticket);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", priority: "media", status_dev: "backlog" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      create({ data: { parent_ticket_id: parentTicketId, ...values } }),
    onSuccess: () => {
      toast.success("Subchamado criado");
      queryClient.invalidateQueries({ queryKey: ["subtickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", parentTicketId] });
      form.reset();
      setOpen(false);
    },
    onError: (error: any) => toast.error(error?.message ?? "Não foi possível criar o subchamado"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Novo subchamado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo subchamado de desenvolvimento</DialogTitle>
          <DialogDescription>
            A numeração (ex.: 0010.1) é gerada automaticamente pelo sistema.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}
        >
          <div className="space-y-1">
            <Label htmlFor="sub-title">Título</Label>
            <Input id="sub-title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-desc">Descrição</Label>
            <Textarea id="sub-desc" rows={4} {...form.register("description")} />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select
                value={form.watch("priority")}
                onValueChange={(v) => form.setValue("priority", v as FormValues["priority"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Coluna inicial</Label>
              <Select
                value={form.watch("status_dev")}
                onValueChange={(v) => form.setValue("status_dev", v as DevStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(devStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar subchamado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de subchamados de desenvolvimento vinculados a um chamado pai. */
export function ParentSubticketsCard({ parentTicketId }: { parentTicketId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["subtickets", parentTicketId],
    queryFn: () => listSubtickets({ data: { parent_ticket_id: parentTicketId } }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Desenvolvimento ({data.length})</CardTitle>
        <NewSubticketDialog parentTicketId={parentTicketId} />
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum subchamado de desenvolvimento.</p>
        ) : (
          data.map((sub: any) => (
            <div
              key={sub.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {sub.display_number ?? "—"}
                </Badge>
                <span className="text-sm">{sub.title}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {devStatusLabels[(sub.status_dev ?? "backlog") as DevStatus]}
              </Badge>
            </div>
          ))
        )}
        <div className="pt-1">
          <Link to="/dev" className="text-xs text-muted-foreground underline">
            Abrir kanban de desenvolvimento
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
