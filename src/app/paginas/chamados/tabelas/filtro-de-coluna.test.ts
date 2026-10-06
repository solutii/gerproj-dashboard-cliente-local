import { describe, expect, it } from 'vitest';
import { linhaPassaNoFiltroDeColuna } from './filtro-de-coluna';

const linha = {
    COD_CHAMADO: 15191,
    ASSUNTO_CHAMADO: '[ARAGUAIA] Ajuste no calculo de faltas',
    EMAIL_CHAMADO: null,
};

describe('linhaPassaNoFiltroDeColuna', () => {
    it('filtro vazio ou só com espaços deixa a linha passar', () => {
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'ASSUNTO_CHAMADO', value: '' })).toBe(true);
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'ASSUNTO_CHAMADO', value: '   ' })).toBe(
            true
        );
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'ASSUNTO_CHAMADO', value: undefined })).toBe(
            true
        );
    });

    it('compara o texto com o valor da coluna, sem diferenciar maiúsculas', () => {
        expect(
            linhaPassaNoFiltroDeColuna(linha, { id: 'ASSUNTO_CHAMADO', value: 'calculo de FALTAS' })
        ).toBe(true);
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'ASSUNTO_CHAMADO', value: 'ferias' })).toBe(
            false
        );
    });

    it('a busca de assunto também acha pelo NÚMERO do chamado (não descarta o que o servidor achou)', () => {
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'ASSUNTO_CHAMADO', value: '15191' })).toBe(
            true
        );
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'ASSUNTO_CHAMADO', value: '151' })).toBe(
            true
        );
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'ASSUNTO_CHAMADO', value: '99999' })).toBe(
            false
        );
    });

    it('o número do chamado só vale para a busca de assunto; as outras colunas comparam o próprio valor', () => {
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'EMAIL_CHAMADO', value: '15191' })).toBe(
            false
        );
        expect(linhaPassaNoFiltroDeColuna(linha, { id: 'EMAIL_CHAMADO', value: 'x' })).toBe(false); // valor nulo
    });
});
