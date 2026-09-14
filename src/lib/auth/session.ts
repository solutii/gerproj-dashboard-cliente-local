// src/lib/auth/session.ts
//
// Sessão real do servidor — substitui o "login" que hoje vive só no
// localStorage do navegador (useAuthStore.ts). Segue o mesmo padrão HMAC de
// cliente-token.ts/link-validacao.ts, mas usa Web Crypto (crypto.subtle) em
// vez de node:crypto — middleware.ts roda em runtime Edge por padrão no
// Next.js, e Web Crypto é a única API de assinatura disponível nos dois
// runtimes (Edge e Node) ao mesmo tempo.
//
// SESSAO_SECRET é lido a cada chamada (não capturado numa const no topo do
// módulo, diferente dos outros dois tokens) — isso deixa o módulo testável
// com vi.stubEnv() e evita depender da ordem de import/carregamento do
// arquivo em relação à configuração do ambiente.

const VALIDADE_MS = 8 * 60 * 60 * 1000; // 8 horas

export interface SessaoPayloadCliente {
    loginType: 'cliente';
    codCliente: string | null;
    codRecurso: string | null;
    nomeRecurso: string | null;
    userEmail: string;
    exp: number;
}

export interface SessaoPayloadConsultor {
    loginType: 'consultor';
    codUsuario: number;
    idUsuario: string;
    nomeUsuario: string;
    tipoUsuario: 'USU' | 'ADM';
    permissoes: { permtar: boolean; perproj1: boolean; perproj2: boolean };
    userEmail: string;
    exp: number;
}

export type SessaoPayload = SessaoPayloadCliente | SessaoPayloadConsultor;

export const SESSAO_COOKIE_NOME = 'sessao';
export const SESSAO_MAX_AGE_SEGUNDOS = VALIDADE_MS / 1000;

function obterSecret(): string | undefined {
    return process.env.SESSAO_SECRET;
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
    const pad = b64url.length % 4 === 0 ? '' : '='.repeat(4 - (b64url.length % 4));
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function obterChave(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

export async function assinarSessao(payload: SessaoPayload): Promise<string | null> {
    const secret = obterSecret();
    if (!secret) return null;

    const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const chave = await obterChave(secret);
    const assinaturaBuf = await crypto.subtle.sign(
        'HMAC',
        chave,
        new TextEncoder().encode(payloadB64)
    );
    const assinaturaB64 = bytesToBase64Url(new Uint8Array(assinaturaBuf));

    return `${payloadB64}.${assinaturaB64}`;
}

export async function verificarSessao(
    token: string | null | undefined
): Promise<SessaoPayload | null> {
    const secret = obterSecret();
    if (!token || !secret) return null;

    const partes = token.split('.');
    if (partes.length !== 2) return null;
    const [payloadB64, assinaturaB64] = partes;
    if (!payloadB64 || !assinaturaB64) return null;

    try {
        const chave = await obterChave(secret);
        const assinaturaValida = await crypto.subtle.verify(
            'HMAC',
            chave,
            base64UrlToBytes(assinaturaB64),
            new TextEncoder().encode(payloadB64)
        );
        if (!assinaturaValida) return null;

        const json = new TextDecoder().decode(base64UrlToBytes(payloadB64));
        const payload = JSON.parse(json) as SessaoPayload;
        if (typeof payload.exp !== 'number') return null;
        if (Date.now() > payload.exp) return null;

        return payload;
    } catch {
        return null;
    }
}

/** Reassina a sessão com uma nova expiração (sliding window) — usado pelo middleware a cada requisição autenticada. */
export async function renovarSessao(payload: SessaoPayload): Promise<string | null> {
    return assinarSessao({ ...payload, exp: Date.now() + VALIDADE_MS } as SessaoPayload);
}
