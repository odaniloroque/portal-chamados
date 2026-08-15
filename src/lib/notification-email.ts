export type NotificationType = "abertura" | "fechamento" | "status_alterado";

const BRAND = "#0B3C74";
const ACCENT = "#00C4F3";

function layout(title: string, body: string, ctaUrl: string) {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#2B2B2B">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:${BRAND};padding:20px 24px">
      <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:.5px">Projetus Tech</span>
      <span style="color:${ACCENT};font-size:12px;display:block;margin-top:2px">Infrastructure &amp; Service</span>
    </td></tr>
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:18px;color:${BRAND}">${title}</h1>
      <div style="font-size:14px;line-height:1.6">${body}</div>
      <p style="margin:24px 0 0">
        <a href="${ctaUrl}" style="background:${BRAND};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block">Ver chamado</a>
      </p>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#f8fafc;font-size:12px;color:#6b7280">
      Este é um email automático do Portal de Chamados da Projetus Tech. Não responda esta mensagem.
    </td></tr>
  </table>
</body></html>`;
}

export function buildNotificationEmail(params: {
  type: NotificationType;
  displayNumber: string;
  title: string;
  statusLabel: string;
  clientName: string;
  ticketUrl: string;
}) {
  const { type, displayNumber, title, statusLabel, clientName, ticketUrl } = params;
  const greeting = `<p style="margin:0 0 12px">Olá, ${clientName}.</p>`;
  const info = `<p style="margin:0 0 12px"><strong>Chamado ${displayNumber}</strong><br/>${title}</p>`;

  if (type === "abertura") {
    return {
      subject: `Chamado ${displayNumber} registrado`,
      html: layout(
        "Chamado registrado",
        `${greeting}${info}<p style="margin:0">Recebemos sua solicitação e nossa equipe já foi notificada. Acompanhe o andamento pelo portal.</p>`,
        ticketUrl,
      ),
    };
  }
  if (type === "fechamento") {
    return {
      subject: `Chamado ${displayNumber} fechado`,
      html: layout(
        "Chamado fechado",
        `${greeting}${info}<p style="margin:0">Este chamado foi concluído e encerrado. Se precisar de algo mais, abra um novo chamado pelo portal.</p>`,
        ticketUrl,
      ),
    };
  }
  return {
    subject: `Chamado ${displayNumber}: ${statusLabel}`,
    html: layout(
      "Situação atualizada",
      `${greeting}${info}<p style="margin:0">A situação do seu chamado mudou para <strong>${statusLabel}</strong>.</p>`,
      ticketUrl,
    ),
  };
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  respondido_cliente: "Respondido pelo cliente",
  em_desenvolvimento: "Em desenvolvimento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};
