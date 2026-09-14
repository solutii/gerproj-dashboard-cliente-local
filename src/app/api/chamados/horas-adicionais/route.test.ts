import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock, buscarFeriadosMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    buscarFeriadosMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

vi.mock('@/lib/os/feriados-service', () => ({
    buscarFeriados: buscarFeriadosMock,
}));

function criarRequest(query: string) {
    return new NextRequest(`http://localhost/api/chamados/horas-adicionais${query}`);
}

describe('GET /api/chamados/horas-adicionais', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando ids não é informado', async () => {
        const response = await GET(criarRequest(''));

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando ids excede o limite de 500', async () => {
        const idsExcedentes = Array.from({ length: 501 }, (_, i) => i + 1).join(',');

        const response = await GET(criarRequest(`?ids=${idsExcedentes}`));

        expect(response.status).toBe(400);
    });

    it('calcula sem adicional para OS dentro do horário comercial em dia útil', async () => {
        buscarFeriadosMock.mockResolvedValueOnce([]);
        // 2026-01-06 é uma terça-feira.
        firebirdQueryMock.mockResolvedValueOnce([
            { COD_CHAMADO: 55, DTINI_OS: '2026-01-06', HRINI_OS: '0800', HRFIM_OS: '1000' },
        ]);

        const response = await GET(criarRequest('?ids=55'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data['55']).toEqual({
            horasAdicionalGerado: 0,
            totalHorasEquivalente: 2,
            totalHorasBruto: 2,
        });
    });

    it('aplica o adicional de 50% para OS fora do horário comercial e agrega múltiplas OS do mesmo chamado', async () => {
        buscarFeriadosMock.mockResolvedValueOnce([]);
        firebirdQueryMock.mockResolvedValueOnce([
            // Dentro do comercial: 2h sem adicional.
            { COD_CHAMADO: 60, DTINI_OS: '2026-01-06', HRINI_OS: '0800', HRFIM_OS: '1000' },
            // Fora do comercial (noite): 2h com adicional -> equivalente 3h.
            { COD_CHAMADO: 60, DTINI_OS: '2026-01-06', HRINI_OS: '1900', HRFIM_OS: '2100' },
        ]);

        const response = await GET(criarRequest('?ids=60'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data['60']).toEqual({
            horasAdicionalGerado: 1,
            totalHorasEquivalente: 5,
            totalHorasBruto: 4,
        });
    });

    it('busca feriados uma única vez por ano distinto presente nas OS', async () => {
        buscarFeriadosMock.mockResolvedValue([]);
        firebirdQueryMock.mockResolvedValueOnce([
            { COD_CHAMADO: 55, DTINI_OS: '2026-01-06', HRINI_OS: '0800', HRFIM_OS: '0900' },
            { COD_CHAMADO: 55, DTINI_OS: '2026-01-06', HRINI_OS: '0900', HRFIM_OS: '1000' },
            { COD_CHAMADO: 60, DTINI_OS: '2025-06-10', HRINI_OS: '0800', HRFIM_OS: '0900' },
        ]);

        await GET(criarRequest('?ids=55,60'));

        expect(buscarFeriadosMock).toHaveBeenCalledTimes(2);
    });

    it('retorna 500 quando a consulta ao banco falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));

        const response = await GET(criarRequest('?ids=55'));

        expect(response.status).toBe(500);
    });
});
