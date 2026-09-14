import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        env: {
            SESSAO_SECRET: 'segredo-de-teste-nao-usar-em-producao',
            CLIENTE_TOKEN_SECRET: 'segredo-cliente-token-de-teste-nao-usar-em-producao',
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
