import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/logout', () => {
    it('limpa o cookie de sessão', async () => {
        const response = await POST();

        expect(response.status).toBe(200);
        const cookie = response.cookies.get('sessao');
        expect(cookie?.value).toBe('');
        expect(cookie?.maxAge).toBe(0);
    });
});
