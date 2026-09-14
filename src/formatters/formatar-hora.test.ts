import { describe, expect, it } from 'vitest';
import { formatarHora } from './formatar-hora';

describe('formatarHora', () => {
    it('retorna "-" para valor vazio', () => {
        expect(formatarHora(null)).toBe('-');
        expect(formatarHora(undefined)).toBe('-');
        expect(formatarHora('')).toBe('-');
    });

    it('aceita formato HH:MM:SS', () => {
        expect(formatarHora('15:00:00')).toBe('15:00');
    });

    it('aceita formato HHMM (4 dígitos)', () => {
        expect(formatarHora('1500')).toBe('15:00');
    });

    it('retorna "-" para formato não reconhecido', () => {
        expect(formatarHora('meio-dia')).toBe('-');
    });

    it('retorna "-" para hora ou minuto fora do intervalo válido', () => {
        expect(formatarHora('2500')).toBe('-');
        expect(formatarHora('0075')).toBe('-');
    });
});
