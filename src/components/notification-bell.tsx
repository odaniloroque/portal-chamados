import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RelativeTime } from "@/lib/relative-time";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateMyNotificationPrefs,
} from "@/lib/notifications.functions";

const TYPE_LABELS: Record<string, string> = {
  abertura: "Chamado aberto",
  fechamento: "Chamado fechado",
  status_alterado: "Situação atualizada",
};

export function NotificationBell({ emailEnabled }: { emailEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const list = useServerFn(listMyNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const updatePrefs = useServerFn(updateMyNotificationPrefs);
  const [emailPref, setEmailPref] = useState(emailEnabled);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => list(),
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notificações</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={async () => {
                await markAll();
                await refresh();
              }}
            >
              <CheckCheck className="mr-1 h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação por enquanto.
            </p>
          )}
          {items.map((n) => (
            <Link
              key={n.id}
              to="/portal/chamado/$id"
              params={{ id: n.ticket_id }}
              onClick={async () => {
                setOpen(false);
                if (!n.read) {
                  await markOne({ data: { id: n.id } });
                  await refresh();
                }
              }}
              className={`block border-b px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50 ${
                n.read ? "" : "bg-sky-50/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#0B3C74]">
                  {TYPE_LABELS[n.type] ?? "Atualização"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  <RelativeTime value={n.created_at} />
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-700">{n.message}</p>
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <Label htmlFor="notif-email" className="text-xs">
            Receber por email
          </Label>
          <Switch
            id="notif-email"
            checked={emailPref}
            onCheckedChange={async (v) => {
              setEmailPref(v);
              await updatePrefs({ data: { email_notifications: v } });
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
