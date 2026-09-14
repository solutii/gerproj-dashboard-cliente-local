import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const {
    firebirdQueryMock,
    firebirdExecuteMock,
    sendMailMock,
    enviarWhatsAppMock,
    excedeuLimiteMock,
} = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    firebirdExecuteMock: vi.fn(),
    sendMailMock: vi.fn(),
    enviarWhatsAppMock: vi.fn(),
    excedeuLimiteMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
    firebirdExecute: firebirdExecuteMock,
}));

vi.mock('@/lib/mail/mailer', () => ({
    sendMail: sendMailMock,
}));

vi.mock('@/lib/whatsapp/zap', async (importOriginal) => {
    const real = await importOriginal<typeof import('@/lib/whatsapp/zap')>();
    return { ...real, enviarWhatsApp: enviarWhatsAppMock };
});

vi.mock('@/lib/rate-limit', () => ({
    excedeuLimite: excedeuLimiteMock,
    obterIp: () => '127.0.0.1',
}));

function corpoValido(extra: Record<string, unknown> = {}) {
    return {
        assunto: 'Erro na agenda',
        solicitacao: 'Não consigo abrir a agenda do módulo financeiro.',
        codCliente: '9',
        solicitante: 'Fulano de Tal',
        email: 'fulano@cliente.com',
        telefone: '31999998888',
        codDepartamento: '1',
        codArea: '2',
        rotina: 'Agenda',
        codClassificacao: '3',
        ...extra,
    };
}

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/chamados', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/chamados (criar chamado)', () => {
    beforeEach(() => {
        excedeuLimiteMock.mockReturnValue(false);
        sendMailMock.mockResolvedValue(undefined);
        enviarWhatsAppMock.mockResolvedValue('ok');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 429 quando o rate limit foi excedido', async () => {
        excedeuLimiteMock.mockReturnValue(true);

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(429);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando assunto ou descrição estão vazios', async () => {
        const response = await POST(criarRequest(corpoValido({ assunto: '  ' })));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Assunto e descrição são obrigatórios.');
    });

    it('retorna 400 quando solicitante, e-mail ou telefone estão vazios', async () => {
        const response = await POST(criarRequest(corpoValido({ telefone: '' })));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Solicitante, e-mail e telefone são obrigatórios.');
    });

    it('retorna 400 quando departamento, área ou classificação estão ausentes', async () => {
        const response = await POST(criarRequest(corpoValido({ codDepartamento: undefined })));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Departamento, módulo e tipo de solicitação são obrigatórios.');
    });

    it('retorna 400 quando o cliente selecionado pelo ADM é inválido ou inativo', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]); // CLIENTE ativo -> não encontrado

        const response = await POST(
            criarRequest(corpoValido({ codClienteSelecionado: '99', prioridadeSelecionada: '2' }))
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Cliente selecionado inválido ou inativo.');
    });

    it('retorna 400 quando o ADM abre o chamado sem informar prioridade válida', async () => {
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 99 }]); // CLIENTE ativo -> ok

        const response = await POST(criarRequest(corpoValido({ codClienteSelecionado: '99' })));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Prioridade é obrigatória e deve ser 1, 2 ou 3.');
    });

    it('retorna 400 quando o recurso selecionado é inválido ou inativo', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]); // RECURSO ativo -> não encontrado

        const response = await POST(criarRequest(corpoValido({ codRecursoSelecionado: '50' })));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Recurso selecionado inválido ou inativo.');
    });

    it('retorna 404 quando o cliente final não é encontrado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]); // lookup final de CLIENTE -> não encontrado

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error).toBe('Cliente não encontrado.');
    });

    it('cria o chamado (fluxo do próprio cliente), grava STATUS NAO INICIADO e dispara notificações', async () => {
        firebirdQueryMock
            // lookup final de CLIENTE (CEL/ZAP/NOME)
            .mockResolvedValueOnce([
                { CEL_CLIENTE: '', ZAP_CLIENTE: 'NAO', NOME_CLIENTE: 'Cliente Teste' },
            ])
            // inserirChamado: próximo COD_CHAMADO
            .mockResolvedValueOnce([{ PROXIMO: 501 }]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.cod_chamado).toBe(501);

        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
        const [insertSql, insertParams] = firebirdExecuteMock.mock.calls[0];
        expect(insertSql).toContain('INSERT INTO CHAMADO');
        expect(insertParams[0]).toBe(501); // COD_CHAMADO
        expect(insertParams[3]).toBe('NAO INICIADO'); // STATUS_CHAMADO (sem recurso)
        expect(insertParams[4]).toBe('[Cliente] Erro na agenda'); // ASSUNTO_CHAMADO prefixado

        // E-mail pro suporte + confirmação pro solicitante.
        expect(sendMailMock).toHaveBeenCalledTimes(2);

        // WhatsApp: pelo menos pro telefone digitado no formulário.
        expect(enviarWhatsAppMock).toHaveBeenCalledWith('31999998888', expect.any(String));
    });

    it('tenta novamente ao colidir com a PK (COD_CHAMADO já usado por outro processo)', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([
                { CEL_CLIENTE: '', ZAP_CLIENTE: 'NAO', NOME_CLIENTE: 'Cliente Teste' },
            ])
            .mockResolvedValueOnce([{ PROXIMO: 501 }])
            .mockResolvedValueOnce([{ PROXIMO: 502 }]);
        firebirdExecuteMock
            .mockRejectedValueOnce(new Error('violation of PRIMARY KEY constraint'))
            .mockResolvedValueOnce(undefined);

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.cod_chamado).toBe(502);
        expect(firebirdExecuteMock).toHaveBeenCalledTimes(2);
    });

    it('retorna 500 quando a criação do chamado falha por um erro que não é de colisão de PK', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([
                { CEL_CLIENTE: '', ZAP_CLIENTE: 'NAO', NOME_CLIENTE: 'Cliente Teste' },
            ])
            .mockResolvedValueOnce([{ PROXIMO: 501 }]);
        firebirdExecuteMock.mockRejectedValueOnce(new Error('conexão perdida'));

        const response = await POST(criarRequest(corpoValido()));

        expect(response.status).toBe(500);
        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
    });
});
