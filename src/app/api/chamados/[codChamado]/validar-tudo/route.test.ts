import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const {
    firebirdExecuteMock,
    firebirdExecuteTransactionMock,
    firebirdQueryMock,
    verificarLinkValidacaoMock,
    excedeuLimiteMock,
} = vi.hoisted(() => ({
    firebirdExecuteMock: vi.fn(),
    firebirdExecuteTransactionMock: vi.fn(),
    firebirdQueryMock: vi.fn(),
    verificarLinkValidacaoMock: vi.fn(),
    excedeuLimiteMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdExecute: firebirdExecuteMock,
    firebirdExecuteTransaction: firebirdExecuteTransactionMock,
    firebirdQuery: firebirdQueryMock,
}));

vi.mock('@/lib/auth/link-validacao', () => ({
    verificarLinkValidacao: verificarLinkValidacaoMock,
}));

vi.mock('@/lib/rate-limit', () => ({
    excedeuLimite: excedeuLimiteMock,
    obterIp: () => '127.0.0.1',
}));

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/chamados/55/validar-tudo', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/chamados/[codChamado]/validar-tudo', () => {
    beforeEach(() => {
        excedeuLimiteMock.mockReturnValue(false);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 429 quando o rate limit foi excedido', async () => {
        excedeuLimiteMock.mockReturnValue(true);

        const response = await POST(criarRequest({ token: 'qualquer' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(429);
        expect(verificarLinkValidacaoMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando codChamado não é válido', async () => {
        const response = await POST(criarRequest({ token: 'qualquer' }), {
            params: { codChamado: 'abc' },
        });
        expect(response.status).toBe(400);
    });

    it('retorna 403 quando o token é inválido ou expirado', async () => {
        verificarLinkValidacaoMock.mockReturnValue(null);

        const response = await POST(criarRequest({ token: 'invalido' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 403 quando o token é de outro chamado', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 999, codCliente: '9' });

        const response = await POST(criarRequest({ token: 'de-outro-chamado' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 409 quando o chamado já foi finalizado (link não permite revalidar)', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ STATUS_CHAMADO: 'FINALIZADO' }]);

        const response = await POST(criarRequest({ token: 'valido' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(409);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
        expect(firebirdExecuteTransactionMock).not.toHaveBeenCalled();
    });

    it('aprova todas as OS e finaliza o chamado atomicamente', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdExecuteMock.mockResolvedValueOnce(undefined);
        firebirdQueryMock
            .mockResolvedValueOnce([{ STATUS_CHAMADO: 'AGUARDANDO VALIDACAO' }])
            .mockResolvedValueOnce([{ DATA: null, HORA: null }])
            .mockResolvedValueOnce([{ ID: 501 }]);
        firebirdExecuteTransactionMock.mockResolvedValueOnce(undefined);

        const response = await POST(criarRequest({ token: 'valido' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);

        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
        const [updateOsSql, updateOsParams] = firebirdExecuteMock.mock.calls[0];
        expect(updateOsSql).toContain('UPDATE OS');
        expect(updateOsParams[1]).toBe('55');

        expect(firebirdExecuteTransactionMock).toHaveBeenCalledTimes(1);
        const statements = firebirdExecuteTransactionMock.mock.calls[0][0];
        expect(statements).toHaveLength(2);
        expect(statements[0].sql).toContain('UPDATE CHAMADO');
        expect(statements[0].sql).toContain("STATUS_CHAMADO <> 'FINALIZADO'");
        expect(statements[0].params[1]).toBe(55);
        expect(statements[1].sql).toContain('INSERT INTO HISTCHAMADO');
        expect(statements[1].params).toEqual([
            501,
            55,
            expect.any(String),
            expect.any(String),
            'FINALIZADO',
        ]);
    });

    it('retorna 500 quando a transação de finalização falha', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdExecuteMock.mockResolvedValueOnce(undefined);
        firebirdQueryMock
            .mockResolvedValueOnce([{ STATUS_CHAMADO: 'AGUARDANDO VALIDACAO' }])
            .mockResolvedValueOnce([{ DATA: null, HORA: null }])
            .mockResolvedValueOnce([{ ID: 501 }]);
        firebirdExecuteTransactionMock.mockRejectedValueOnce(new Error('conexão perdida'));

        const response = await POST(criarRequest({ token: 'valido' }), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Erro ao validar chamado');
    });
});
