// ─── Template de e-mail de chamado — card único reaproveitado por todos os
//     destinatários (suporte, cliente, recurso), só muda header/título/texto ──

export interface ChamadoCardParams {
    codChamado: number;
    nomeCliente: string;
    solicitante: string;
    emailSolicitante: string;
    telefoneSolicitante: string;
    assunto: string;
    descricaoChamado: string; // HTML vindo do TipTap
}

function renderCardChamado(params: ChamadoCardParams): string {
    const {
        codChamado,
        nomeCliente,
        solicitante,
        emailSolicitante,
        telefoneSolicitante,
        assunto,
        descricaoChamado,
    } = params;
    const numFormatado = String(codChamado).padStart(5, '0');

    // Remove o wrapper <html><body>…</body></html> se vier do formatarSolicitacao
    const descricaoHtml = descricaoChamado
        .replace(/^\s*<html[^>]*>\s*<body[^>]*>/i, '')
        .replace(/<\/body>\s*<\/html>\s*$/i, '')
        .trim();

    const linha = (label: string, valor: string) => `
        <tr>
          <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#5a6475; width:170px; vertical-align:top;">
            ${label}
          </td>
          <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#1a2535;">
            ${valor}
          </td>
        </tr>`;

    return `
        <table width="100%" cellspacing="0" cellpadding="0"
          style="border:1px solid #dde6f0; border-radius:12px; margin:0 0 20px 0; background:#f8fafd;">
          <tr>
            <td style="padding:16px 20px;">
              <table width="100%" cellspacing="0" cellpadding="6">
                ${linha('Número', `<strong style="color:#0f3d63;">#${numFormatado}</strong>`)}
                ${linha('Cliente', `<strong>${nomeCliente}</strong>`)}
                ${linha('Solicitante', `<strong>${solicitante}</strong>`)}
                ${linha('E-mail do solicitante', emailSolicitante)}
                ${linha('Telefone do solicitante', telefoneSolicitante || '-')}
                ${linha('Assunto', `<strong>${assunto}</strong>`)}
                <tr>
                  <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#5a6475; width:170px; vertical-align:top;">
                    Descrição
                  </td>
                  <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#2a2e35; line-height:1.7;">
                    ${descricaoHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;
}

interface WrapperEmailChamadoParams {
    headerLine: string;
    titulo: string;
    subtitulo: string;
    cardHtml: string;
    footerNote: string;
}

function wrapperEmailChamado(params: WrapperEmailChamadoParams): string {
    const { headerLine, titulo, subtitulo, cardHtml, footerNote } = params;

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
                  <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:18px; color:#e6f1ff; font-weight:700;">
                    Solutii <span style="font-weight:600; color:#9bd4ff;">Sistemas</span>
                  </div>
                  <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px; color:#cde6ff; margin-top:2px;">
                    ${headerLine}
                  </div>
                </td>
              </tr>

              <!-- CORPO -->
              <tr>
                <td style="padding:28px 32px 10px 32px;">
                  <h1 style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:20px; color:#0f3d63; margin:0 0 6px 0;">
                    ${titulo}
                  </h1>
                  <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#6a7280; margin:0 0 22px 0;">
                    ${subtitulo}
                  </p>

                  ${cardHtml}

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
              <em>${footerNote}</em>
            </p>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

const FOOTER_NOTE_INTERNO = 'Notificação interna automática — não responda a este e-mail.';
const FOOTER_NOTE_CLIENTE =
    'Esta é uma mensagem automática gerada pelo portal Solutii. Por favor, não responda este e-mail.';

// ─── Template enviado ao suporte — novo chamado recebido ──────────────────────
export function templateChamadoRecebido(params: ChamadoCardParams): string {
    return wrapperEmailChamado({
        headerLine: 'Novo chamado recebido (aberto pelo portal Solutii)',
        titulo: 'Novo Chamado Recebido',
        subtitulo: 'Um novo chamado foi aberto pelo portal e aguarda atribuição no sistema.',
        cardHtml: renderCardChamado(params),
        footerNote: FOOTER_NOTE_INTERNO,
    });
}

// ─── Template enviado ao cliente/solicitante — chamado em análise ─────────────
export function templateChamadoEmAnalise(params: ChamadoCardParams): string {
    return wrapperEmailChamado({
        headerLine: 'Chamado em análise (aberto pelo portal Solutii)',
        titulo: 'Prezado(a) Cliente,',
        subtitulo:
            'Agradecemos pelo contato e informamos que a sua solicitação, encontra-se em análise.',
        cardHtml: renderCardChamado(params),
        footerNote: FOOTER_NOTE_CLIENTE,
    });
}

// ─── Template enviado ao recurso — chamado atribuído diretamente a ele ────────
export function templateChamadoAtribuido(params: ChamadoCardParams): string {
    return wrapperEmailChamado({
        headerLine: 'Novo chamado atribuído (aberto pelo portal Solutii)',
        titulo: 'Novo Chamado Atribuído',
        subtitulo:
            'Um novo chamado foi atribuído a você. Caso tenha alguma dúvida, por favor, entre em contato com o suporte.',
        cardHtml: renderCardChamado(params),
        footerNote: FOOTER_NOTE_INTERNO,
    });
}

// ─── Template de senha temporária ("Esqueci minha senha") ────────────────────
export function templateNovaSenha(senhaTemporaria: string): string {
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
              <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:18px; color:#e6f1ff; font-weight:700;">
                Solutii <span style="font-weight:600; color:#9bd4ff;">Sistemas</span>
              </div>
              <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:12px; color:#cde6ff; margin-top:2px;">
                Consultoria, customização e suporte em Totvs Protheus
              </div>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:28px 32px;">
              <h1 style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:20px; color:#0f3d63; margin:0 0 12px 0;">
                Nova senha de acesso
              </h1>
              <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:15px; color:#2a2e35; margin:0 0 18px 0;">
                Recebemos uma solicitação de redefinição de senha para a sua conta no
                <strong>Portal Solutii</strong>. Geramos uma nova senha temporária para você:
              </p>

              <table width="100%" cellspacing="0" cellpadding="0"
                style="border:1px solid #e6edf6; border-radius:12px; margin:0 0 18px 0; background:#f8fafd;">
                <tr>
                  <td align="center" style="padding:18px;">
                    <span style="font-family:Consolas,Menlo,monospace; font-size:22px; font-weight:700; color:#0f3d63; letter-spacing:.06em;">
                      ${senhaTemporaria}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:14px; color:#3b3f46; margin:0 0 6px 0;">
                Use essa senha para entrar no portal e, por segurança, recomendamos trocá-la
                assim que possível (opção "Alterar Senha" no menu lateral).
              </p>
              <p style="font-family:Segoe UI,Arial,Helvetica,sans-serif; font-size:13px; color:#6a7280; margin:16px 0 0 0;">
                Se você não solicitou essa alteração, entre em contato com a gente em
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
