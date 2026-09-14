import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

function criarRequest(query: string) {
    return new NextRequest(`http://localhost/api/chamados/horas-por-mes${query}`);
}

describe('GET /api/chamados/horas-por-mes', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando ids não é informado', async () => {
        const response = await GET(criarRequest(''));

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando ids não contém nenhum valor válido', async () => {
        const response = await GET(criarRequest('?ids=abc,,-1'));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("Parâmetro 'ids' não contém valores válidos");
    });

    it('retorna 400 quando ids excede o limite de 500', async () => {
        const idsExcedentes = Array.from({ length: 501 }, (_, i) => i + 1).join(',');

        const response = await GET(criarRequest(`?ids=${idsExcedentes}`));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Máximo de 500 IDs por requisição');
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('agrupa as horas faturadas por chamado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            { COD_CHAMADO: 55, MES_OS: 1, ANO_OS: 2026, TOTAL_HORAS_FATURADAS: 5.5 },
            { COD_CHAMADO: 55, MES_OS: 2, ANO_OS: 2026, TOTAL_HORAS_FATURADAS: 3 },
            { COD_CHAMADO: 60, MES_OS: 1, ANO_OS: 2026, TOTAL_HORAS_FATURADAS: 2 },
        ]);

        const response = await GET(criarRequest('?ids=55,60'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data['55']).toEqual([
            { mes: 1, ano: 2026, horasFaturadas: 5.5 },
            { mes: 2, ano: 2026, horasFaturadas: 3 },
        ]);
        expect(body.data['60']).toEqual([{ mes: 1, ano: 2026, horasFaturadas: 2 }]);

        const [sql, params] = firebirdQueryMock.mock.calls[0];
        expect(sql).toContain("FATURADO_OS) <> 'NAO'");
        expect(params).toEqual([55, 60]);
    });

    it('retorna 500 quando a consulta ao banco falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));

        const response = await GET(criarRequest('?ids=55'));

        expect(response.status).toBe(500);
    });
});
