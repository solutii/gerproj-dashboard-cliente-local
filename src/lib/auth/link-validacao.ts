// src/lib/auth/link-validacao.ts
//
// Token assinado (HMAC-SHA256) que dá acesso restrito a UM chamado
// específico, sem exigir login — usado no botão do email "chamado aguardando
// validação" disparado quando o STATUS_CHAMADO vira FINALIZADO. Gerado só
// por POST /api/gerar-link-validacao (protegido por chave interna, chamado
// pelo sistema Delphi) e consumido em /validar/[token].
//
// Deliberadamente separado do cliente-token.ts (login normal): esse token
// não abre a aplicação inteira, só a tela de validação daquele chamado.

import crypto from 'crypto';

const SECRET = process.env.LINK_VALIDACAO_SECRET;
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

interface LinkValidacaoPayload {
    codChamado: number;
    codCliente: string;
    exp: number;
}

function base64UrlEncode(input: string): string {
    return Buffer.from(input, 'utf-8').toString('base64url');
}

function base64UrlDecode(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf-8');
}

function assinar(payloadB64: string): string {
    return crypto
        .createHmac('sha256', SECRET as string)
        .update(payloadB64)
        .digest('base64url');
}

export function assinarLinkValidacao(codChamado: number, codCliente: string): string | null {
    if (!SECRET) return null;

    const payload: LinkValidacaoPayload = {
        codChamado,
        codCliente,
        exp: Date.now() + VALIDADE_MS,
    };
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    return `${payloadB64}.${assinar(payloadB64)}`;
}

export function verificarLinkValidacao(
    token: string | null | undefined
): { codChamado: number; codCliente: string } | null {
    if (!token || !SECRET) return null;

    const partes = token.split('.');
    if (partes.length !== 2) return null;

    const [payloadB64, assinatura] = partes;
    if (!payloadB64 || !assinatura) return null;

    const assinaturaEsperada = assinar(payloadB64);
    const bufAssinatura = Buffer.from(assinatura);
    const bufEsperada = Buffer.from(assinaturaEsperada);
    if (bufAssinatura.length !== bufEsperada.length) return null;
    if (!crypto.timingSafeEqual(bufAssinatura, bufEsperada)) return null;

    try {
        const payload: LinkValidacaoPayload = JSON.parse(base64UrlDecode(payloadB64));
        if (
            typeof payload.codChamado !== 'number' ||
            typeof payload.codCliente !== 'string' ||
            typeof payload.exp !== 'number'
        ) {
            return null;
        }
        if (Date.now() > payload.exp) return null;

        return { codChamado: payload.codChamado, codCliente: payload.codCliente };
    } catch {
        return null;
    }
}
