import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const { firebirdQueryMock, firebirdExecuteMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    firebirdExecuteMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
    firebirdExecute: firebirdExecuteMock,
}));

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/chamados/55/avaliacao', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/chamados/[codChamado]/avaliacao', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando codChamado não é um número válido', async () => {
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: 'abc' },
        });
        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando a avaliação está fora do intervalo 1-5', async () => {
        const response = await POST(criarRequest({ avaliacao: 6, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o chamado não existe', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(404);
    });

    it('retorna 403 quando o chamado pertence a outro cliente', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { STATUS_CHAMADO: 'FINALIZADO', AVALIA_CHAMADO: 1, COD_CLIENTE: 999 },
        ]);
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando o chamado ainda não está finalizado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { STATUS_CHAMADO: 'EM ATENDIMENTO', AVALIA_CHAMADO: 1, COD_CLIENTE: 9 },
        ]);
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Apenas chamados finalizados podem ser avaliados');
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando o chamado já foi avaliado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { STATUS_CHAMADO: 'FINALIZADO', AVALIA_CHAMADO: 4, COD_CLIENTE: 9 },
        ]);
        const response = await POST(criarRequest({ avaliacao: 5, codCliente: '9' }), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Este chamado já foi avaliado anteriormente');
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('salva a avaliação quando o chamado está finalizado e ainda não foi avaliado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { STATUS_CHAMADO: 'FINALIZADO', AVALIA_CHAMADO: 1, COD_CLIENTE: 9 },
        ]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest({ avaliacao: 5, observacao: 'Ótimo atendimento', codCliente: '9' }),
            { params: { codChamado: '55' } }
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);

        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
        const [sql, params] = firebirdExecuteMock.mock.calls[0];
        expect(sql).toContain('UPDATE CHAMADO');
        expect(params).toEqual([5, 'Ótimo atendimento', 55]);
    });
});

describe('GET /api/chamados/[codChamado]/avaliacao', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 404 quando o chamado não existe', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);
        const response = await GET(new NextRequest('http://localhost/api/chamados/55/avaliacao'), {
            params: { codChamado: '55' },
        });
        expect(response.status).toBe(404);
    });

    it('retorna os dados da avaliação e foiAvaliado calculado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            {
                COD_CHAMADO: 55,
                AVALIA_CHAMADO: 4,
                OBSAVAL_CHAMADO: 'Bom atendimento',
                STATUS_CHAMADO: 'FINALIZADO',
            },
        ]);

        const response = await GET(new NextRequest('http://localhost/api/chamados/55/avaliacao'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.foiAvaliado).toBe(true);
        expect(body.avaliacao).toBe(4);
    });
});
