import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

function criarRequest(query: string) {
    return new Request(`http://localhost/api/dashboard/total-chamados-os${query}`);
}

describe('GET /api/dashboard/total-chamados-os', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando codCliente não é informado', async () => {
        const response = await GET(criarRequest('?mes=1&ano=2026'));

        expect(response.status).toBe(400);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando mes está fora do intervalo 1-12', async () => {
        const response = await GET(criarRequest('?codCliente=9&mes=13&ano=2026'));

        expect(response.status).toBe(400);
    });

    it('retorna 400 quando ano é inválido', async () => {
        const response = await GET(criarRequest('?codCliente=9&mes=5&ano=1500'));

        expect(response.status).toBe(400);
    });

    it('retorna os totalizadores por status', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            {
                TOTAL_CHAMADOS: 10,
                CHAMADOS_AGUARDANDO_VALIDACAO: 2,
                CHAMADOS_ATRIBUIDO: 1,
                CHAMADOS_EM_ATENDIMENTO: 3,
                CHAMADOS_FINALIZADO: 4,
                CHAMADOS_STANDBY: 0,
            },
        ]);

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.TOTAL_CHAMADOS).toBe(10);
        expect(body.CHAMADOS_FINALIZADO).toBe(4);

        const [, params] = firebirdQueryMock.mock.calls[0];
        expect(params).toEqual(['01.01.2026', '01.02.2026', 9]);
    });

    it('retorna zerado quando não há nenhum registro', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.TOTAL_CHAMADOS).toBe(0);
    });

    it('retorna 500 quando a consulta ao banco falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('timeout'));

        const response = await GET(criarRequest('?codCliente=9&mes=1&ano=2026'));

        expect(response.status).toBe(500);
    });
});
