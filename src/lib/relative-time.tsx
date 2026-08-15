const RTF = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatFullDate(input: string | Date): string {
  return new Date(input).toLocaleString("pt-BR");
}

/** Tempo relativo para eventos recentes; data completa acima de 30 dias. */
export function formatRelativeTime(input: string | Date): string {
  const date = new Date(input);
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.round(diffMs / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (Math.abs(days) > 30) return formatFullDate(date);
  if (Math.abs(seconds) < 60) return "agora mesmo";
  if (Math.abs(minutes) < 60) return RTF.format(-minutes, "minute");
  if (Math.abs(hours) < 24) return RTF.format(-hours, "hour");
  return RTF.format(-days, "day");
}

export function RelativeTime({
  value,
  prefix,
  className,
}: {
  value: string | Date;
  prefix?: string;
  className?: string;
}) {
  const full = formatFullDate(value);
  return (
    <time
      dateTime={new Date(value).toISOString()}
      title={full}
      aria-label={full}
      className={className}
    >
      {prefix ? `${prefix} ` : ""}
      {formatRelativeTime(value)}
    </time>
  );
}
