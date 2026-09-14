import { describe, expect, it } from 'vitest';
import { formatarNumeros, formatarPrioridade } from './formatar-numeros';

describe('formatarNumeros', () => {
    it('formata número inteiro com separador de milhar', () => {
        expect(formatarNumeros(1234567)).toBe('1.234.567');
    });

    it('aceita valor em string, descartando caracteres não numéricos', () => {
        expect(formatarNumeros('OS-000123')).toBe('123');
    });

    it('retorna string vazia para null/undefined', () => {
        expect(formatarNumeros(null)).toBe('');
        expect(formatarNumeros(undefined)).toBe('');
    });

    it('trata o número 0 como valor válido (não como "vazio")', () => {
        expect(formatarNumeros(0)).toBe('0');
    });

    it('retorna string vazia quando não sobra nenhum dígito', () => {
        expect(formatarNumeros('abc')).toBe('');
    });
});

describe('formatarPrioridade', () => {
    it('prefixa a prioridade com "P-"', () => {
        expect(formatarPrioridade(3)).toBe('P-3');
    });
});
