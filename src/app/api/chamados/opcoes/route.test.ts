import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { firebirdQueryMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

describe('GET /api/chamados/opcoes', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna departamentos, áreas e classificações ordenados e sem nomes vazios', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([
                { COD_DEPARTAMENTO: 2, NOME_DEPARTAMENTO: 'Suporte' },
                { COD_DEPARTAMENTO: 1, NOME_DEPARTAMENTO: 'Comercial' },
                { COD_DEPARTAMENTO: 3, NOME_DEPARTAMENTO: '  ' },
            ])
            .mockResolvedValueOnce([{ COD_AREA: 5, NOME_AREA: 'Financeiro' }])
            .mockResolvedValueOnce([{ COD_CLASSIFICACAO: 9, NOME_CLASSIFICACAO: 'Bug' }]);

        const response = await GET();

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.departamentos).toEqual([
            { cod: 1, nome: 'Comercial' },
            { cod: 2, nome: 'Suporte' },
        ]);
        expect(body.areas).toEqual([{ cod: 5, nome: 'Financeiro' }]);
        expect(body.classificacoes).toEqual([{ cod: 9, nome: 'Bug' }]);
        expect(firebirdQueryMock).toHaveBeenCalledTimes(3);
    });

    it('retorna listas vazias quando não há opções ativas', async () => {
        firebirdQueryMock
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        const response = await GET();

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ departamentos: [], areas: [], classificacoes: [] });
    });

    it('retorna 500 quando a consulta ao banco falha', async () => {
        firebirdQueryMock.mockRejectedValueOnce(new Error('conexão perdida'));

        const response = await GET();

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Erro ao buscar opções do formulário.');
    });
});
