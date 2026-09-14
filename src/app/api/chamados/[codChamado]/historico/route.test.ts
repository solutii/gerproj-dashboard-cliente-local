import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

function criarRequest(query = '') {
    return new NextRequest(`http://localhost/api/chamados/55/historico${query}`);
}

describe('GET /api/chamados/[codChamado]/historico', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando codChamado não é um número válido', async () => {
        const response = await GET(criarRequest(), { params: { codChamado: 'abc' } });

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o chamado não existe', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await GET(criarRequest(), { params: { codChamado: '55' } });

        expect(response.status).toBe(404);
    });

    it('retorna 403 quando o codCliente informado não é o dono do chamado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CHAMADO: 55, COD_CLIENTE: 9 }]);

        const response = await GET(criarRequest('?codCliente=999'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(403);
    });

    it('retorna o histórico ordenado quando o chamado existe e o cliente é o dono', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([{ COD_CHAMADO: 55, COD_CLIENTE: 9 }])
            .mockResolvedValueOnce([
                {
                    COD_HISTCHAMADO: 1,
                    COD_CHAMADO: 55,
                    DATA_HISTCHAMADO: '01.01.2026',
                    HORA_HISTCHAMADO: '0900',
                    DESC_HISTCHAMADO: 'ATRIBUIDO',
                },
                {
                    COD_HISTCHAMADO: 2,
                    COD_CHAMADO: 55,
                    DATA_HISTCHAMADO: '02.01.2026',
                    HORA_HISTCHAMADO: '1000',
                    DESC_HISTCHAMADO: 'FINALIZADO',
                },
            ]);

        const response = await GET(criarRequest('?codCliente=9'), {
            params: { codChamado: '55' },
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.historico).toHaveLength(2);
        expect(body.historico[1].descricao).toBe('FINALIZADO');

        const [sqlHistorico] = firebirdQueryMock.mock.calls[1];
        expect(sqlHistorico).toContain('ORDER BY COD_HISTCHAMADO ASC');
    });

    it('permite acesso sem restrição quando nenhum codCliente é informado (fluxo ADM)', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([{ COD_CHAMADO: 55, COD_CLIENTE: 9 }])
            .mockResolvedValueOnce([]);

        const response = await GET(criarRequest(), { params: { codChamado: '55' } });

        expect(response.status).toBe(200);
    });
});
