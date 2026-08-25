// ─── Equivalente ao fEnvZAP() do serviço Delphi legado ───────────────────────

interface ZapPayload {
    instance: string;
    type: 'text';
    content: {
        telephone: string; // formato: '55' + DDD + número
        message: string;
    };
}

/**
 * Envia uma mensagem de WhatsApp via API smclick.
 * Retorna a resposta da API ou lança um erro em caso de falha.
 */
export async function enviarWhatsApp(
    celular: string, // apenas DDD + número, sem o '55' (ex: "31995539920")
    mensagem: string
): Promise<string> {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    const instanceId = process.env.WHATSAPP_INSTANCE_ID;

    if (!apiUrl || !apiKey || !instanceId) {
        throw new Error('Variáveis de ambiente do WhatsApp não configuradas.');
    }

    if (!celular.trim() || !mensagem.trim()) {
        throw new Error('Número de celular ou mensagem não informados.');
    }

    const payload: ZapPayload = {
        instance: instanceId,
        type: 'text',
        content: {
            telephone: `55${celular}`,
            message: mensagem,
        },
    };

    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
            'X-API-KEY': apiKey,
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(`WhatsApp API erro ${res.status}: ${text}`);
    }

    return text;
}

interface MensagemChamadoParams {
    codChamado: number;
    nomeCliente: string;
    solicitante: string;
    emailSolicitante: string;
    telefoneSolicitante: string;
    assunto: string;
}

// Layout único reaproveitado pelas 3 mensagens — só o título de abertura muda
// (mesmo padrão dos e-mails: mesma estrutura, texto diferente por destinatário).
function montarMensagemChamado(titulo: string, params: MensagemChamadoParams): string {
    const { codChamado, nomeCliente, solicitante, emailSolicitante, telefoneSolicitante, assunto } =
        params;
    return (
        `${titulo}\n` +
        `(Aberto pelo Portal Solutii)\n\n` +
        `Número: ${codChamado}\n` +
        `Cliente: ${nomeCliente}\n` +
        `Solicitante: ${solicitante}\n` +
        `Email do solicitante: ${emailSolicitante}\n` +
        `Telefone do solicitante: ${telefoneSolicitante || '-'}\n` +
        `Assunto: ${assunto}\n\n` +
        `Por favor, verifique seu email para mais informações`
    );
}

/** Mensagem de WhatsApp para o suporte — novo chamado recebido. */
export function montarMensagemChamadoRecebido(params: MensagemChamadoParams): string {
    return montarMensagemChamado('NOVO CHAMADO ABERTO', params);
}

/** Mensagem de WhatsApp para o cliente — confirmação de chamado em análise. */
export function montarMensagemChamadoEmAnalise(params: MensagemChamadoParams): string {
    return montarMensagemChamado('NOVO CHAMADO ABERTO', params);
}

/**
 * Mensagem de WhatsApp para o recurso responsável, quando um ADM já abre o
 * chamado atribuindo diretamente a ele.
 */
export function montarMensagemChamadoAtribuido(params: MensagemChamadoParams): string {
    return montarMensagemChamado('NOVO CHAMADO ATRIBUÍDO', params);
}
