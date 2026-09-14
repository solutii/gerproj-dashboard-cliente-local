import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

function criarRequest(query: string) {
    return new Request(`http://localhost/api/dashboard/hrs-contratadas-hrs-executadas${query}`);
}

describe('GET /api/dashboard/hrs-contratadas-hrs-executadas', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando codCliente não é informado', async () => {
        const response = await GET(criarRequest('?mes=1&ano=2026'));

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna zerado quando não há apontamentos no período', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.totalHorasContratadas).toBe(0);
        expect(body.detalhesClientes).toEqual([]);
    });

    it('agrega horas contratadas x executadas (faturadas e não faturadas) por cliente', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            {
                COD_CLIENTE: 9,
                NOME_CLIENTE: 'Cliente Teste',
                COD_TAREFA: 1,
                LIMMES_TAREFA: 20,
                HRINI_OS: '0800',
                HRFIM_OS: '1000',
                FATURADO_OS: 'SIM',
            },
            {
                COD_CLIENTE: 9,
                NOME_CLIENTE: 'Cliente Teste',
                COD_TAREFA: 1,
                LIMMES_TAREFA: 20,
                HRINI_OS: '1000',
                HRFIM_OS: '1100',
                FATURADO_OS: 'NAO',
            },
        ]);

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.totalHorasContratadas).toBe(20);
        expect(body.totalHorasFaturadas).toBe(2);
        expect(body.totalHorasNaoFaturadas).toBe(1);
        expect(body.totalHorasExecutadas).toBe(3);
        expect(body.detalhesClientes).toHaveLength(1);
        expect(body.detalhesClientes[0].nome_cliente).toBe('Cliente Teste');
        expect(body.resumo.diferencaHoras).toBe(17);
        expect(body.resumo.percentualExecucao).toBe(15);
    });

    it('retorna 500 quando a consulta ao banco falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(500);
    });
});
