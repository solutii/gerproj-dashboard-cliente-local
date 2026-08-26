// src/lib/auth/cliente-token-client.ts
'use client';

// Lado do navegador do token de src/lib/auth/cliente-token.ts — só lê o
// valor gravado no login e monta o header. A verificação/assinatura em si
// só roda no servidor (usa o módulo `crypto` do Node, indisponível aqui).

/**
 * Header `x-cliente-token` pra anexar em fetches de leitura escopados por
 * cliente (saldo de horas, dashboard, chamados). Vazio quando não há token
 * salvo (login de ADM, ou sessão antiga sem essa proteção) — nesse caso as
 * rotas caem de volta no comportamento anterior, sem quebrar nada.
 */
export function getClienteTokenHeaders(): Record<string, string> {
    try {
        const token = localStorage.getItem('clienteToken');
        return token ? { 'x-cliente-token': token } : {};
    } catch {
        return {};
    }
}
