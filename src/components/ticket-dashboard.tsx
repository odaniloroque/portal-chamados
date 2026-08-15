import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label as RLabel,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Minus,
  Ticket as TicketIcon,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* ---------- constantes de apresentação ---------- */

const statusOrder = [
  "aberto",
  "em_andamento",
  "aguardando_cliente",
  "respondido_cliente",
  "em_desenvolvimento",
  "resolvido",
  "fechado",
] as const;

const statusText: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  respondido_cliente: "Respondido pelo cliente",
  em_desenvolvimento: "Em desenvolvimento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const statusColor: Record<string, string> = {
  aberto: "var(--chart-blue)",
  em_andamento: "var(--chart-orange)",
  aguardando_cliente: "var(--chart-purple)",
  respondido_cliente: "var(--chart-cyan, var(--chart-blue))",
  em_desenvolvimento: "var(--chart-orange)",
  resolvido: "var(--chart-green)",
  fechado: "var(--chart-gray)",
};

const priorityOrder = ["baixa", "media", "alta", "critica"] as const;

const priorityText: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const priorityColor: Record<string, string> = {
  baixa: "var(--chart-gray)",
  media: "var(--chart-blue)",
  alta: "var(--chart-orange)",
  critica: "var(--chart-red)",
};

const finished = (s: string) => s === "resolvido" || s === "fechado";

/* ---------- utilidades ---------- */

function formatDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function avgResolutionMinutes(list: any[]) {
  const done = list.filter((t) => finished(t.status));
  if (done.length === 0) return null;
  const sum = done.reduce((acc, t) => {
    const start = new Date(t.created_at).getTime();
    const end = new Date(t.updated_at ?? t.created_at).getTime();
    return acc + Math.max(0, end - start) / 60000;
  }, 0);
  return sum / done.length;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/* ---------- cartões de resumo ---------- */

function Delta({
  value,
  suffix = "",
  invert = false,
}: {
  value: number | null;
  suffix?: string;
  invert?: boolean;
}) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">sem período anterior</span>;
  }
  const rounded = Math.round(value * 10) / 10;
  const neutral = rounded === 0;
  const good = invert ? rounded < 0 : rounded > 0;
  const Icon = neutral ? Minus : good ? ArrowUpRight : ArrowDownRight;
  const tone = neutral
    ? "text-muted-foreground"
    : good
      ? "text-emerald-600"
      : "text-rose-600";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {neutral ? "estável" : `${rounded > 0 ? "+" : ""}${rounded}${suffix}`}
      <span className="font-normal text-muted-foreground">vs. período anterior</span>
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
  footer,
  title,
}: {
  icon: any;
  label: string;
  value: string;
  tint: string;
  footer: React.ReactNode;
  title?: string;
}) {
  return (
    <Card
      title={title}
      className="group overflow-hidden rounded-2xl border-border/60 shadow-sm transition-all duration-[250ms] hover:-translate-y-0.5 hover:shadow-lg"
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          </div>
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-[250ms] group-hover:scale-110 ${tint}`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <div className="mt-3">{footer}</div>
      </CardContent>
    </Card>
  );
}

/* ---------- tooltip padrão ---------- */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-popover-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color ?? p.payload?.fill }}
          />
          {p.name}: <span className="font-semibold text-popover-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ---------- componente principal ---------- */

export function TicketDashboard({
  tickets,
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
}: {
  tickets: any[];
  statusFilter: string;
  priorityFilter: string;
  onStatusChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
}) {
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const data = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const periodStart = now - range * day;
    const prevStart = now - 2 * range * day;

    const current = tickets.filter((t) => new Date(t.created_at).getTime() >= periodStart);
    const previous = tickets.filter((t) => {
      const c = new Date(t.created_at).getTime();
      return c >= prevStart && c < periodStart;
    });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    }

    const total = tickets.length;
    const pending = tickets.filter((t) => !finished(t.status)).length;
    const resolved = total - pending;

    const avgNow = avgResolutionMinutes(current);
    const avgPrev = avgResolutionMinutes(previous);
    const avgDelta =
      avgNow !== null && avgPrev !== null && avgPrev > 0
        ? ((avgNow - avgPrev) / avgPrev) * 100
        : null;

    const rateNow = current.length ? pct(current.filter((t) => finished(t.status)).length, current.length) : null;
    const ratePrev = previous.length
      ? pct(previous.filter((t) => finished(t.status)).length, previous.length)
      : null;
    const rateDelta = rateNow !== null && ratePrev !== null ? rateNow - ratePrev : null;

    const totalDelta = previous.length
      ? ((current.length - previous.length) / previous.length) * 100
      : null;

    // série temporal
    const series: { date: string; criados: number; resolvidos: number }[] = [];
    const first = startOfDay(new Date(now - (range - 1) * day));
    for (let i = 0; i < range; i++) {
      const d = new Date(first.getTime() + i * day);
      const next = new Date(d.getTime() + day);
      const criados = tickets.filter((t) => {
        const c = new Date(t.created_at).getTime();
        return c >= d.getTime() && c < next.getTime();
      }).length;
      const resolvidos = tickets.filter((t) => {
        if (!finished(t.status)) return false;
        const u = new Date(t.updated_at ?? t.created_at).getTime();
        return u >= d.getTime() && u < next.getTime();
      }).length;
      series.push({
        date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        criados,
        resolvidos,
      });
    }

    const today = startOfDay(new Date()).getTime();
    const createdToday = tickets.filter(
      (t) => new Date(t.created_at).getTime() >= today,
    ).length;
    const resolvedToday = tickets.filter(
      (t) => finished(t.status) && new Date(t.updated_at ?? t.created_at).getTime() >= today,
    ).length;

    const oldestOpen = tickets
      .filter((t) => !finished(t.status))
      .reduce<number | null>((acc, t) => {
        const age = (now - new Date(t.created_at).getTime()) / 60000;
        return acc === null || age > acc ? age : acc;
      }, null);

    // SLA: finalizados em até 48h
    const done = tickets.filter((t) => finished(t.status));
    const withinSla = done.filter(
      (t) =>
        new Date(t.updated_at ?? t.created_at).getTime() - new Date(t.created_at).getTime() <=
        48 * 60 * 60 * 1000,
    ).length;

    return {
      total,
      pending,
      resolved,
      byStatus,
      byPriority,
      avgNow,
      avgDelta,
      rateNow: rateNow ?? pct(resolved, total),
      rateDelta,
      currentCount: current.length,
      totalDelta,
      series,
      createdToday,
      resolvedToday,
      oldestOpen,
      slaPct: done.length ? pct(withinSla, done.length) : null,
      avgAll: avgResolutionMinutes(tickets),
    };
  }, [tickets, range]);

  if (data.total === 0) return null;

  const statusData = statusOrder
    .map((s) => ({
      key: s,
      name: statusText[s]!,
      value: data.byStatus[s] ?? 0,
      fill: statusColor[s]!,
    }))
    .filter((s) => s.value > 0);

  const priorityData = priorityOrder.map((p) => ({
    key: p,
    name: priorityText[p]!,
    value: data.byPriority[p] ?? 0,
    fill: priorityColor[p]!,
  }));

  return (
    <section className="space-y-6">
      {/* 1. Resumo geral */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={TicketIcon}
          label="Total de chamados"
          value={String(data.total)}
          tint="bg-blue-50 text-blue-600"
          title="Todos os chamados registrados"
          footer={<Delta value={data.totalDelta} suffix="%" />}
        />
        <KpiCard
          icon={Clock}
          label="Chamados pendentes"
          value={String(data.pending)}
          tint="bg-orange-50 text-orange-600"
          title="Chamados ainda não finalizados"
          footer={
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {pct(data.pending, data.total)}%
              </span>{" "}
              do total
            </span>
          }
        />
        <KpiCard
          icon={Timer}
          label="Tempo médio de atendimento"
          value={formatDuration(data.avgNow ?? data.avgAll)}
          tint="bg-purple-50 text-purple-600"
          title="Tempo médio entre abertura e finalização"
          footer={<Delta value={data.avgDelta} suffix="%" invert />}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Taxa de resolução"
          value={`${data.rateNow}%`}
          tint="bg-emerald-50 text-emerald-600"
          title="Percentual de chamados finalizados"
          footer={<Delta value={data.rateDelta} suffix=" p.p." />}
        />
      </div>

      {/* 2. Distribuição */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chamados por status</CardTitle>
          </CardHeader>
          <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ChartTooltip />} />
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="88%"
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive
                  >
                    {statusData.map((d) => (
                      <Cell
                        key={d.key}
                        fill={d.fill}
                        className="cursor-pointer transition-opacity hover:opacity-80"
                        onClick={() => onStatusChange(statusFilter === d.key ? "todos" : d.key)}
                      />
                    ))}
                    <RLabel
                      position="center"
                      content={({ viewBox }: any) => (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            dy="-0.2em"
                            className="fill-foreground text-2xl font-bold"
                          >
                            {data.total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            dy="1.6em"
                            className="fill-muted-foreground text-xs"
                          >
                            chamados
                          </tspan>
                        </text>
                      )}
                    />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5">
              {statusOrder.map((s) => {
                const count = data.byStatus[s] ?? 0;
                const active = statusFilter === s;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => onStatusChange(active ? "todos" : s)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-[250ms] hover:bg-muted ${
                        active ? "bg-muted ring-1 ring-primary/30" : ""
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: statusColor[s] }}
                      />
                      <span className="min-w-0 flex-1 truncate">{statusText[s]}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {pct(count, data.total)}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chamados por prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 24, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(0 0% 50% / 0.06)" }} />
                  <Bar dataKey="value" name="Chamados" radius={[8, 8, 0, 0]} maxBarSize={64}>
                    <LabelList dataKey="value" position="top" fontSize={12} />
                    {priorityData.map((d) => (
                      <Cell
                        key={d.key}
                        fill={d.fill}
                        className="cursor-pointer transition-opacity hover:opacity-80"
                        onClick={() =>
                          onPriorityChange(priorityFilter === d.key ? "todas" : d.key)
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Evolução */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">Evolução dos chamados</span>
          </CardTitle>
          <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-1">
            {([7, 30, 90] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setRange(r)}
              >
                {r}d
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="criados"
                  name="Criados"
                  stroke="var(--chart-blue)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="resolvidos"
                  name="Resolvidos"
                  stroke="var(--chart-green)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-4 rounded-full"
                style={{ background: "var(--chart-blue)" }}
              />
              Criados
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-4 rounded-full"
                style={{ background: "var(--chart-green)" }}
              />
              Resolvidos
            </span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ---------- 5. Indicadores extras ---------- */

export function TicketMiniStats({ tickets }: { tickets: any[] }) {
  const stats = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const done = tickets.filter((t) => finished(t.status));
    const withinSla = done.filter(
      (t) =>
        new Date(t.updated_at ?? t.created_at).getTime() - new Date(t.created_at).getTime() <=
        48 * 60 * 60 * 1000,
    ).length;
    return {
      createdToday: tickets.filter((t) => new Date(t.created_at).getTime() >= today).length,
      resolvedToday: done.filter(
        (t) => new Date(t.updated_at ?? t.created_at).getTime() >= today,
      ).length,
      avg: avgResolutionMinutes(tickets),
      sla: done.length ? pct(withinSla, done.length) : null,
      openNow: tickets.filter((t) => !finished(t.status)).length,
    };
  }, [tickets]);

  if (tickets.length === 0) return null;

  const items = [
    { label: "Criados hoje", value: String(stats.createdToday) },
    { label: "Resolvidos hoje", value: String(stats.resolvedToday) },
    { label: "Tempo médio p/ resolução", value: formatDuration(stats.avg) },
    { label: "SLA cumprido (48h)", value: stats.sla === null ? "—" : `${stats.sla}%` },
    { label: "Em aberto agora", value: String(stats.openNow) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((i) => (
        <div
          key={i.label}
          className="rounded-xl border border-border/60 bg-card px-3 py-2 transition-colors duration-[250ms] hover:bg-muted/50"
        >
          <p className="truncate text-[11px] text-muted-foreground">{i.label}</p>
          <p className="text-sm font-semibold tabular-nums">{i.value}</p>
        </div>
      ))}
    </div>
  );
}
