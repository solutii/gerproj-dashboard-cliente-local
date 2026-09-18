import { expect, test } from '@playwright/test';
import { E2E_LINK_VALIDACAO_SECRET } from '../playwright.config';

// Precisa ser setado ANTES do import de link-validacao.ts, que lê
// process.env.LINK_VALIDACAO_SECRET uma única vez, no carregamento do
// módulo — o mesmo segredo é passado para o servidor via webServer.env
// no playwright.config.ts, então os dois processos assinam/validam com a
// mesma chave (nunca a real do .env).
process.env.LINK_VALIDACAO_SECRET = E2E_LINK_VALIDACAO_SECRET;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- precisa
// rodar depois de setar a env var acima; um import estático seria hoisted.
const { assinarLinkValidacao } = require('../src/lib/auth/link-validacao');

const COD_CHAMADO = 501;
const COD_CLIENTE = '9';

const OS_FIXTURE = {
    COD_OS: 1001,
    NUM_OS: '000123',
    DTINI_OS: '2026-01-06',
    HRINI_OS: '0800',
    HRFIM_OS: '1000',
    TOTAL_HORAS_OS: 2,
    NOME_RECURSO: 'Consultor Teste',
    OBS: 'Atendimento de suporte',
    VALCLI_OS: null,
    OBSCLI_OS: null,
};

async function mockApiOS(page: import('@playwright/test').Page, chamadoFinalizado = false) {
    await page.route('**/api/chamados/*/os*', async (route) => {
        await route.fulfill({
            json: {
                success: true,
                codChamado: COD_CHAMADO,
                dataChamado: '2026-01-06',
                chamadoFinalizado,
                data: [OS_FIXTURE],
            },
        });
    });
}

test.describe('Validação de chamado pelo cliente (/validar/[token])', () => {
    test('token válido: lista a OS e aprova individualmente', async ({ page }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page);
        await page.route('**/api/salvar-validacao', async (route) => {
            await route.fulfill({
                json: {
                    success: true,
                    message: 'Validação salva com sucesso',
                    data: { cod_os: OS_FIXTURE.COD_OS, valcli_os: 'SIM' },
                },
            });
        });

        await page.goto(`/validar/${token}`);

        await expect(page.getByText(`Nº ${String(COD_CHAMADO).padStart(5, '0')}`)).toBeVisible();
        await expect(page.getByText('Consultor Teste')).toBeVisible();

        await page.getByRole('button', { name: 'Aprovada' }).click();
        await page.getByRole('button', { name: 'Salvar' }).click();

        await expect(page.getByText(/validada com sucesso/i)).toBeVisible();
    });

    test('token válido: "Validar chamado" aprova todas as OS de uma vez', async ({ page }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page);
        await page.route('**/api/chamados/*/validar-tudo', async (route) => {
            await route.fulfill({ json: { success: true } });
        });

        await page.goto(`/validar/${token}`);

        await page.getByRole('button', { name: 'Validar chamado (aprovar todas as OS)' }).click();

        await expect(page.getByText(/Isso vai aprovar TODAS as OS/i)).toBeVisible();
        await page.getByRole('button', { name: 'Sim, aprovar tudo' }).click();

        await expect(page.getByText('Chamado validado com sucesso!')).toBeVisible();
    });

    test('chamado já finalizado: tela somente leitura, sem botões de validar', async ({ page }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page, true);
        await page.goto(`/validar/${token}`);

        await expect(page.getByText('Consultor Teste')).toBeVisible();
        await expect(page.getByText(/já foi validado e está finalizado/i)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Aprovada' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: 'Validar chamado (aprovar todas as OS)' })
        ).toHaveCount(0);
    });

    test('token inválido: mostra tela de link inválido, sem carregar a listagem', async ({
        page,
    }) => {
        let chamouApiOS = false;
        await page.route('**/api/chamados/*/os*', async (route) => {
            chamouApiOS = true;
            await route.abort();
        });

        await page.goto('/validar/token-forjado-invalido');

        await expect(page.getByText('Link inválido ou expirado')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Ir para o login' })).toBeVisible();
        expect(chamouApiOS).toBe(false);
    });
});
