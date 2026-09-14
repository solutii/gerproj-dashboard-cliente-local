import { describe, expect, it } from 'vitest';
import { formatarDataHoraChamado, formatarDataParaBR } from './formatar-data';

describe('formatarDataParaBR', () => {
    it('retorna placeholder para valor vazio', () => {
        expect(formatarDataParaBR(null)).toBe('---------------');
        expect(formatarDataParaBR(undefined)).toBe('---------------');
        expect(formatarDataParaBR('')).toBe('---------------');
    });

    it('mantém valor já no formato dd/mm/yyyy', () => {
        expect(formatarDataParaBR('25/12/2026')).toBe('25/12/2026');
    });

    it('converte formato ISO yyyy-mm-dd para dd/mm/yyyy', () => {
        expect(formatarDataParaBR('2026-01-05')).toBe('05/01/2026');
    });

    it('converte ISO com hora (yyyy-mm-ddTHH:mm) quando incluirHora=true', () => {
        expect(formatarDataParaBR('2026-01-05T14:30:00', true)).toBe('05/01/2026 - 14:30');
    });

    it('devolve o valor original quando não reconhece o formato', () => {
        expect(formatarDataParaBR('não é uma data')).toBe('não é uma data');
    });
});

describe('formatarDataHoraChamado', () => {
    it('junta data e hora formatadas com um traço', () => {
        expect(formatarDataHoraChamado('2026-01-05', '1430')).toBe('05/01/2026 - 14:30');
    });
});
