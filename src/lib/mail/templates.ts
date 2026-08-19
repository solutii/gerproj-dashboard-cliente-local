// ─── Template de confirmação de abertura de chamado ──────────────────────────

export interface ConfirmacaoChamadoParams {
    codChamado: number;
    assunto: string;
    emailSolicitante: string;
    slaCliente: number; // 0 = sem SLA contratado
}

// Renderiza bloco SLA dinâmico:
// - sla === 0 → upsell (igual ao Delphi original)
// - sla > 0   → badge de prioridade ativa
function renderSlaBlock(sla: number): string {
    if (sla === 0) {
        return `
        <table width="100%" cellspacing="0" cellpadding="0"
          style="border:1px solid #e6edf6; border-radius:12px; margin:4px 0 18px 0;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#0f3d63; font-weight:700;">
                Quer melhorar o posicionamento dos seus chamados?
              </div>
              <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#3b3f46; margin-top:4px;">
                Conte com nossos <strong>planos de SLA</strong> para priorização e prazos de
                resposta alinhados com sua operação.
              </div>
              <div style="margin-top:12px;">
                <a href="https://wa.me/5531995539920" target="_blank"
                  style="padding:10px 16px; background:#0f3d63; color:#ffffff; text-decoration:none;
                         border-radius:10px; font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px;">
                  Falar com um especialista
                </a>
              </div>
            </td>
          </tr>
        </table>`;
    }

    const slaLabel = sla <= 30 ? 'Crítico' : sla <= 60 ? 'Alto' : sla <= 80 ? 'Médio' : 'Normal';
    const slaColor =
        sla <= 30 ? '#dc2626' : sla <= 60 ? '#ea580c' : sla <= 80 ? '#ca8a04' : '#6b7280';
    const slaBg = sla <= 30 ? '#fef2f2' : sla <= 60 ? '#fff7ed' : sla <= 80 ? '#fefce8' : '#f9fafb';

    return `
        <table width="100%" cellspacing="0" cellpadding="0"
          style="border:1px solid ${slaColor}55; border-radius:12px; margin:4px 0 18px 0; background:${slaBg};">
          <tr>
            <td style="padding:14px 18px;">
              <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px;
                          color:${slaColor}; font-weight:700; letter-spacing:.03em;">
                ★ SEU PLANO SLA ESTÁ ATIVO
              </div>
              <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px;
                          color:#2a2e35; margin-top:6px;">
                Seu chamado está sendo tratado com prioridade
                <strong style="color:${slaColor};">${slaLabel}</strong>
                conforme o seu contrato de SLA. Nossa equipe seguirá os prazos acordados
                para atendimento e resolução.
              </div>
            </td>
          </tr>
        </table>`;
}

// ─── Template de notificação interna — enviado apenas ao suporte ──────────────

export interface NotificacaoSuporteParams {
    codChamado: number;
    assunto: string;
    emailSolicitante: string;
    nomeCliente: string;
    descricaoChamado: string; // HTML vindo do TipTap
}

export function templateNotificacaoSuporte(params: NotificacaoSuporteParams): string {
    const { codChamado, assunto, emailSolicitante, nomeCliente, descricaoChamado } = params;
    const numFormatado = String(codChamado).padStart(5, '0');

    // Remove o wrapper <html><body>…</body></html> se vier do formatarSolicitacao
    const descricaoHtml = descricaoChamado
        .replace(/^\s*<html[^>]*>\s*<body[^>]*>/i, '')
        .replace(/<\/body>\s*<\/html>\s*$/i, '')
        .trim();

    return `<!DOCTYPE html>
  <html lang="pt-BR">
    <body style="margin:0; padding:0; background:#f0f4f9;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f4f9;">
        <tr>
          <td align="center" style="padding:24px;">
            <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0"
              style="width:620px; max-width:620px; background:#ffffff; border-radius:14px;
                    box-shadow:0 6px 24px rgba(13,30,60,.1); overflow:hidden;">

              <!-- HEADER -->
              <tr>
                <td style="background:#0f3d63; padding:22px 28px;">
                  <table width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="left">
                        <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:18px; color:#e6f1ff; font-weight:700;">
                          Solutii <span style="font-weight:600; color:#9bd4ff;">Sistemas</span>
                        </div>
                        <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px; color:#cde6ff; margin-top:2px;">
                          Notificação interna — novo chamado aberto pelo portal
                        </div>
                      </td>
                      <td align="right">
                        <span style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:11px;
                                    color:#fbbf24; background:rgba(251,191,36,.18);
                                    padding:5px 14px; border-radius:99px; font-weight:700; letter-spacing:.04em;">
                          ● SUPORTE INTERNO
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CORPO -->
              <tr>
                <td style="padding:28px 32px 10px 32px;">
                  <h1 style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:20px; color:#0f3d63; margin:0 0 6px 0;">
                    Novo Chamado Recebido
                  </h1>
                  <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#6a7280; margin:0 0 22px 0;">
                    Um cliente abriu um novo chamado pelo portal e aguarda atribuição da equipe.
                  </p>

                  <!-- CARD DETALHES -->
                  <table width="100%" cellspacing="0" cellpadding="0"
                    style="border:1px solid #dde6f0; border-radius:12px; margin:0 0 20px 0; background:#f8fafd;">
                    <tr>
                      <td style="padding:16px 20px;">
                        <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:11px;
                                    color:#8a96a5; letter-spacing:.08em; text-transform:uppercase; margin-bottom:12px;">
                          Detalhes do Chamado
                        </div>
                        <table width="100%" cellspacing="0" cellpadding="6">
                          <tr>
                            <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#5a6475; width:100px; vertical-align:top;">
                              Número
                            </td>
                            <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:15px; color:#0f3d63; font-weight:700;">
                              #${numFormatado}
                            </td>
                          </tr>
                          <tr>
                            <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#5a6475; vertical-align:top;">
                              Assunto
                            </td>
                            <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#1a2535; font-weight:600;">
                              ${assunto}
                            </td>
                          </tr>
                          <tr>
                            <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#5a6475; vertical-align:top;">
                              Cliente
                            </td>
                            <td>
                              <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#1a2535; font-weight:600;">
                                ${nomeCliente}
                              </div>
                              <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#6a7280; margin-top:2px;">
                                ${emailSolicitante}
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- DESCRIÇÃO DA SOLICITAÇÃO -->
                  <table width="100%" cellspacing="0" cellpadding="0"
                    style="border:1px solid #dde6f0; border-radius:12px; margin:0 0 24px 0;">
                    <tr>
                      <td style="padding:16px 20px;">
                        <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:11px;
                                    color:#8a96a5; letter-spacing:.08em; text-transform:uppercase; margin-bottom:12px;">
                          Descrição da Solicitação
                        </div>
                        <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px;
                                    color:#2a2e35; line-height:1.7;">
                          ${descricaoHtml}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#8a96a5; margin:0 0 8px 0;">
                    Sistema de Chamados — Solutii Sistemas
                  </p>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="padding:16px 28px 24px 28px;">
                  <table width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e8eef5;">
                    <tr>
                      <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px; color:#6a7280; padding-top:14px;">
                        R. José Mendes de Carvalho, 61 – Castelo – Belo Horizonte/MG<br>
                        Solutii Sistemas. Todos os direitos reservados.
                      </td>
                      <td align="right" style="padding-top:14px;">
                        <a href="https://solutii.com.br/politica-de-privacidade/" target="_blank"
                          style="font-size:12px; color:#6a7280; text-decoration:none;">
                          Política de Privacidade
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>

            <p style="margin-top:20px; font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px;
                      color:#9aa1ac; line-height:1.5; text-align:center;">
              <em>Notificação interna automática — não responda a este e-mail.</em>
            </p>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

// ─── Template de confirmação de chamado (enviado ao cliente) ──────────────────
export function templateConfirmacaoChamado(params: ConfirmacaoChamadoParams): string {
    const { codChamado, assunto, emailSolicitante, slaCliente } = params;
    const numFormatado = String(codChamado).padStart(5, '0');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0; padding:0; background:#f4f6fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6fa;">
    <tr>
      <td align="center" style="padding:24px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
          style="width:600px; max-width:600px; background:#ffffff; border-radius:14px;
                 box-shadow:0 6px 24px rgba(13,30,60,.08); overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="background:#0f3d63; padding:22px 24px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:18px; color:#e6f1ff; font-weight:700;">
                      Solutii <span style="font-weight:600; color:#9bd4ff;">Sistemas</span>
                    </div>
                    <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px; color:#cde6ff; margin-top:2px;">
                      Consultoria, customização e suporte em Totvs Protheus
                    </div>
                  </td>
                  <td align="right">
                    <a href="https://solutii.com.br/" target="_blank"
                      style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px; color:#cde6ff; text-decoration:none;">
                      solutii.com.br
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <h1 style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:20px; color:#0f3d63; margin:0 0 12px 0;">
                Prezado(a) Cliente,
              </h1>
              <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:15px; color:#2a2e35; margin:0 0 18px 0;">
                Agradecemos por entrar em contato com a <strong>Solutii Sistemas</strong>.
                Recebemos a sua solicitação e nossa equipe já está trabalhando para atendê-la.
                Em breve, um de nossos especialistas falará com você.
              </p>

              <!-- CARD DO CHAMADO -->
              <table width="100%" cellspacing="0" cellpadding="0"
                style="border:1px solid #e6edf6; border-radius:12px; margin:0 0 14px 0; background:#f8fafd;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px;
                                color:#6a7280; letter-spacing:.06em; margin-bottom:10px;">
                      DETALHES DO CHAMADO
                    </div>
                    <table width="100%" cellspacing="0" cellpadding="4">
                      <tr>
                        <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#0f3d63; width:110px;">
                          <strong>Número</strong>
                        </td>
                        <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#2a2e35;">
                          #${numFormatado}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#0f3d63;">
                          <strong>Assunto</strong>
                        </td>
                        <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#2a2e35;">
                          ${assunto}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#0f3d63;">
                          <strong>Solicitante</strong>
                        </td>
                        <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#2a2e35;">
                          ${emailSolicitante}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#0f3d63;">
                          <strong>Status</strong>
                        </td>
                        <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#2a2e35;">
                          <span style="background:#dbeafe; color:#1d4ed8; padding:2px 10px;
                                       border-radius:99px; font-size:13px; font-weight:600;">
                            Não Iniciado
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- BLOCO SLA DINÂMICO -->
              ${renderSlaBlock(slaCliente)}

              <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#2a2e35; margin:0 0 8px 0;">
                Preferir ligar?
                <br><strong style="color:#0f3d63;">31 99553-9920</strong>
                &nbsp;|&nbsp;<strong style="color:#0f3d63;">31 3324-0632</strong>
                &nbsp;|&nbsp;<strong style="color:#0f3d63;">31 3324-0635</strong>
                <br>Ou envie um e-mail para
                <a href="mailto:contato@solutii.com.br" style="color:#0f3d63;">contato@solutii.com.br</a>.
              </p>

              <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#6a7280; margin:16px 0 0 0;">
                Atenciosamente,<br><strong>Equipe Solutii Sistemas</strong>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:18px 24px 26px 24px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e8eef5;">
                <tr>
                  <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px; color:#6a7280; padding-top:14px;">
                    R. José Mendes de Carvalho, 61 – Castelo – Belo Horizonte/MG<br>
                    Solutii Sistemas. Todos os direitos reservados.
                  </td>
                  <td align="right" style="padding-top:14px;">
                    <a href="https://solutii.com.br/politica-de-privacidade/" target="_blank"
                      style="font-size:12px; color:#6a7280; text-decoration:none;">
                      Política de Privacidade
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <p style="margin-top:20px; font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px;
                  color:#9aa1ac; line-height:1.5; text-align:center;">
          <em>Esta é uma mensagem automática gerada pelo portal Solutii. Por favor, não responda este e-mail.</em>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
