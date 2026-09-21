import { expect, test } from '@playwright/test';
import { E2E_LINK_VALIDACAO_SECRET } from '../playwright.config';

// Precisa ser setado ANTES do import de link-validacao.ts, que lê
// process.env.LINK_VALIDACAO_SECRET uma única vez, no carregamento do
// módulo — o mesmo segredo é passado para o servidor via webServer.env
// no playwright.config.ts, então os dois processos assinam/validam com a
// mesma chave (nunca a real do .env).
process.env.LINK_VALIDACAO_SECRET = E2E_LINK_VALIDACAO_SECRET;

// Precisa rodar depois de setar a env var acima; um import estático seria hoisted.
import { assinarLinkValidacao } from '../src/lib/auth/link-validacao';

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

async function mockApiOS(
    page: import('@playwright/test').Page,
    chamadoFinalizado = false,
    os: Record<string, unknown> | Record<string, unknown>[] = OS_FIXTURE
) {
    await page.route('**/api/chamados/*/os*', async (route) => {
        await route.fulfill({
            json: {
                success: true,
                codChamado: COD_CHAMADO,
                dataChamado: '2026-01-06',
                chamadoFinalizado,
                nomeCliente: 'Cliente Teste Ltda',
                data: Array.isArray(os) ? os : [os],
            },
        });
    });
}

test.describe('Validação de chamado pelo cliente (/paginas/validar/[token])', () => {
    test('token válido: lista a OS somente para leitura, sem aprovar/reprovar por OS', async ({
        page,
    }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page);
        await page.goto(`/paginas/validar/${token}`);

        await expect(page.getByText(`Nº ${String(COD_CHAMADO).padStart(5, '0')}`)).toBeVisible();
        await expect(page.getByText('Consultor Teste')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'VALIDAÇÃO DE CHAMADO' })).toBeVisible();
        await expect(page.getByText('Cliente Teste Ltda')).toBeVisible();
        await expect(page.getByText(/Para contestar alguma OS, acesse o portal/i)).toBeVisible();

        await expect(page.getByRole('button', { name: 'Aprovada' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Reprovada' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Validar Chamado' })).toBeVisible();
    });

    test("texto de instrução concorda com a quantidade de OS (a OS / as OS's)", async ({
        page,
    }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page);
        await page.goto(`/paginas/validar/${token}`);
        await expect(
            page.getByText(
                /Confira a OS abaixo\. Para contestar alguma OS, acesse o portal do cliente, ou fale com o setor responsável\./
            )
        ).toBeVisible();
    });

    test('várias OS: instrução no plural, label "Obs:", cores do status e ordenação', async ({
        page,
    }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page, false, [
            {
                ...OS_FIXTURE,
                COD_OS: 1,
                NUM_OS: '000010',
                DTINI_OS: '2026-01-06',
                OBS: 'obs-A',
                VALCLI_OS: 'SIM',
            },
            {
                ...OS_FIXTURE,
                COD_OS: 2,
                NUM_OS: '000030',
                DTINI_OS: '2026-01-08',
                OBS: 'obs-B',
                VALCLI_OS: 'NAO',
                OBSCLI_OS: 'motivo',
            },
            {
                ...OS_FIXTURE,
                COD_OS: 3,
                NUM_OS: '000020',
                DTINI_OS: '2026-01-07',
                OBS: 'obs-C',
                VALCLI_OS: 'SIM',
            },
        ]);
        await page.goto(`/paginas/validar/${token}`);

        await expect(page.getByText(/Confira as OS's abaixo\./)).toBeVisible();
        await expect(page.getByText('Obs:').first()).toBeVisible();

        const aprovada = page.getByText('Aprovada', { exact: true }).first().locator('..');
        const reprovada = page
            .getByText(/^Reprovada/)
            .first()
            .locator('..');
        await expect(aprovada).toHaveClass(/bg-emerald-100/);
        await expect(reprovada).toHaveClass(/bg-red-100/);
        await expect(aprovada).toHaveClass(/w-fit/);

        const ordemObs = async () =>
            (await page.locator('p', { hasText: 'Obs:' }).allTextContents()).map((t) =>
                t.replace('Obs:', '').trim()
            );

        // padrão: data mais recente primeiro
        expect(await ordemObs()).toEqual(['obs-B', 'obs-C', 'obs-A']);

        await page.getByLabel('Ordenar por').selectOption('os-asc');
        expect(await ordemObs()).toEqual(['obs-A', 'obs-C', 'obs-B']);

        await page.getByLabel('Ordenar por').selectOption('os-desc');
        expect(await ordemObs()).toEqual(['obs-B', 'obs-C', 'obs-A']);

        await page.getByLabel('Ordenar por').selectOption('data-asc');
        expect(await ordemObs()).toEqual(['obs-A', 'obs-C', 'obs-B']);

        await page.getByLabel('Ordenar por').selectOption('status');
        expect((await ordemObs())[0]).toBe('obs-B');
    });

    test('ao rolar, cabeçalho, ordenação e botão ficam fixos e só as OS rolam', async ({
        page,
    }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        const muitasOS = Array.from({ length: 15 }, (_, n) => ({
            ...OS_FIXTURE,
            COD_OS: 100 + n,
            NUM_OS: String(200 + n).padStart(6, '0'),
            OBS: `obs-${n}`,
        }));
        await mockApiOS(page, false, muitasOS);
        await page.setViewportSize({ width: 1280, height: 700 });
        await page.goto(`/paginas/validar/${token}`);

        const cabecalho = page.locator('header');
        const botao = page.getByRole('button', { name: 'Validar Chamado' });
        await expect(botao).toBeVisible();

        const antesCabecalho = await cabecalho.boundingBox();
        const antesBotao = await botao.boundingBox();
        const primeiraOS = page.locator('p', { hasText: 'obs-0' }).first();
        const antesPrimeira = await primeiraOS.boundingBox();

        await page.locator('div.overflow-y-auto').evaluate((el) => {
            el.scrollTop = 600;
        });

        // Cabeçalho e botão não se mexem...
        expect(await cabecalho.boundingBox()).toEqual(antesCabecalho);
        expect(await botao.boundingBox()).toEqual(antesBotao);
        await expect(botao).toBeInViewport();
        // ...e a lista rolou (a primeira OS subiu).
        const depoisPrimeira = await primeiraOS.boundingBox();
        expect(depoisPrimeira!.y).toBeLessThan(antesPrimeira!.y);
    });

    test('OS reprovada: só avisa antes de confirmar, e valida mesmo assim se confirmar', async ({
        page,
    }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page, false, {
            ...OS_FIXTURE,
            VALCLI_OS: 'NAO',
            OBSCLI_OS: 'Horas divergentes',
        });
        let chamouValidarTudo = false;
        await page.route('**/api/chamados/*/validar-tudo', async (route) => {
            chamouValidarTudo = true;
            await route.fulfill({ json: { success: true } });
        });

        await page.goto(`/paginas/validar/${token}`);
        await expect(page.getByText(/Reprovada — Horas divergentes/)).toBeVisible();

        await page.getByRole('button', { name: 'Validar Chamado' }).click();

        await expect(page.getByText(/tem 1 OS reprovada/i)).toBeVisible();
        await page.getByRole('button', { name: 'Sim, aprovar tudo' }).click();

        await expect(page.getByText('Chamado validado com sucesso!')).toBeVisible();
        expect(chamouValidarTudo).toBe(true);
    });

    test('token válido: "Validar chamado" aprova todas as OS de uma vez', async ({ page }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page);
        await page.route('**/api/chamados/*/validar-tudo', async (route) => {
            await route.fulfill({ json: { success: true } });
        });

        await page.goto(`/paginas/validar/${token}`);

        await page.getByRole('button', { name: 'Validar Chamado' }).click();

        await expect(page.getByText(/Isso vai aprovar TODAS as OS/i)).toBeVisible();
        await page.getByRole('button', { name: 'Sim, aprovar tudo' }).click();

        await expect(page.getByText('Chamado validado com sucesso!')).toBeVisible();
    });

    test('chamado já finalizado: tela somente leitura, sem botões de validar', async ({ page }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page, true);
        await page.goto(`/paginas/validar/${token}`);

        await expect(page.getByText('Consultor Teste')).toBeVisible();
        await expect(page.getByText(/já foi validado e está finalizado/i)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Aprovada' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Validar Chamado' })).toHaveCount(0);
    });

    test('link antigo (/validar/[token]) de e-mails já enviados redireciona pro caminho novo', async ({
        page,
    }) => {
        const token = assinarLinkValidacao(COD_CHAMADO, COD_CLIENTE);

        await mockApiOS(page);
        await page.goto(`/validar/${token}`);

        await expect(page).toHaveURL(new RegExp(`/paginas/validar/${token}`));
        await expect(page.getByText('Consultor Teste')).toBeVisible();
    });

    test('token inválido: mostra tela de link inválido, sem carregar a listagem', async ({
        page,
    }) => {
        let chamouApiOS = false;
        await page.route('**/api/chamados/*/os*', async (route) => {
            chamouApiOS = true;
            await route.abort();
        });

        await page.goto('/paginas/validar/token-forjado-invalido');

        await expect(page.getByText('Link inválido ou expirado')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Ir para o login' })).toBeVisible();
        expect(chamouApiOS).toBe(false);
    });
});
