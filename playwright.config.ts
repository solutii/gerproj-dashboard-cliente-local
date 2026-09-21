import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Segredo usado SÓ pelos testes e2e para assinar/validar o token de
// /paginas/validar/[token] — nunca o LINK_VALIDACAO_SECRET real do .env, para não
// depender (nem arriscar tocar) no Firebird real de produção/desenvolvimento.
export const E2E_LINK_VALIDACAO_SECRET = 'e2e-test-secret-nao-usar-em-producao';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: `npm run dev -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
            LINK_VALIDACAO_SECRET: E2E_LINK_VALIDACAO_SECRET,
        },
    },
});
