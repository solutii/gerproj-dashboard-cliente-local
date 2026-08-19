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

/**
 * Monta a mensagem de notificação de novo chamado,
 * equivalente ao sZapMsg do Delphi.
 */
export function montarMensagemChamado(params: {
    codChamado: number;
    emailCliente: string;
    assunto: string;
    responsavel?: string;
    telefone?: string;
    nomeEmpresa?: string;
}): string {
    const { codChamado, emailCliente, assunto, responsavel, telefone, nomeEmpresa } = params;
    return (
        `NOVO CHAMADO TÉCNICO ABERTO\n` +
        `(Aberto pelo portal Solutii)\n\n` +
        `Número: ${codChamado}\n` +
        `Assunto: ${assunto}\n` +
        (nomeEmpresa ? `Cliente: ${nomeEmpresa}\n` : '') +
        (responsavel ? `Responsável: ${responsavel}\n` : '') +
        `E-Mail: ${emailCliente}` +
        (telefone ? `\nTel: ${telefone}` : '')
    );
}
