// src/app/api/chamados/[codChamado]/validar-tudo/route.ts
//
// Aprova TODAS as OS's de um chamado de uma vez (checkbox "Validar chamado"
// da tela /paginas/validar/[token]) — sobrescreve inclusive alguma OS que já
// estivesse reprovada, por decisão explícita do fluxo. Exige um token de
// link-validacao válido para o MESMO chamado — não aceita um codCliente
// solto, diferente de /api/salvar-validacao (que também aceita chamadas de
// dentro da aplicação já logada).
import { safeErrorMessage } from '@/lib/api-error';
import { verificarLinkValidacao } from '@/lib/auth/link-validacao';
import {
    firebirdExecute,
    firebirdExecuteTransaction,
    firebirdQuery,
} from '@/lib/firebird/firebird-client';
import { excedeuLimite, obterIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

// Mesmo cálculo de CONCLUSAO_CHAMADO do fluxo "Apenas finalizar o chamado"
// do gerproj-solutii (src/services/call/change-status.ts) — usa a última
// DTINI_OS/HRFIM_OS lançada no chamado como data/hora de conclusão, caindo
// para "agora" quando o chamado não tem nenhuma OS.
async function calcularConclusaoChamado(codChamado: number): Promise<string> {
    const [ultimaOs] = await firebirdQuery<{ DATA: Date | null; HORA: string | null }>(
        `SELECT MAX(DTINI_OS) AS DATA, MAX(HRFIM_OS) AS HORA FROM OS WHERE CHAMADO_OS = ?`,
        [String(codChamado)]
    );

    let data: string;
    let hora: string;

    if (ultimaOs?.DATA && ultimaOs?.HORA) {
        data = new Date(ultimaOs.DATA)
            .toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' })
            .replaceAll('/', '-')
            .replaceAll(',', '');
        hora = ultimaOs.HORA.substring(0, 2) + ':' + ultimaOs.HORA.substring(2, 4);
    } else {
        data = new Date()
            .toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' })
            .replaceAll('/', '-')
            .replaceAll(',', '');
        hora = new Date().toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' });
    }

    return new Date(`${data} ${hora}`)
        .toLocaleString('pt-br', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
        .replaceAll('/', '.')
        .replace('T', '');
}

// Mesmas duas escritas do fluxo "Apenas finalizar o chamado" do
// gerproj-solutii (ChangeStatusService), na MESMA transação (igual ao
// original): fecha o CHAMADO e grava o histórico atomicamente — ou os dois
// aplicam, ou nenhum. A cláusula STATUS_CHAMADO <> 'FINALIZADO' torna a
// chamada idempotente caso o chamado já tenha sido finalizado antes.
async function finalizarChamado(codChamado: number): Promise<void> {
    const conclusaoChamado = await calcularConclusaoChamado(codChamado);

    const [{ ID: novoId }] = await firebirdQuery<{ ID: number }>(
        `SELECT MAX(COD_HISTCHAMADO) + 1 AS ID FROM HISTCHAMADO`,
        []
    );

    await firebirdExecuteTransaction([
        {
            sql: `UPDATE CHAMADO SET STATUS_CHAMADO = 'FINALIZADO', CONCLUSAO_CHAMADO = ?
                  WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> 'FINALIZADO'`,
            params: [conclusaoChamado, codChamado],
        },
        {
            sql: `INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO)
                  VALUES (?, ?, ?, ?, ?)`,
            params: [
                novoId,
                codChamado,
                new Date()
                    .toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' })
                    .replaceAll('/', '.')
                    .replaceAll(',', ''),
                new Date()
                    .toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' })
                    .replaceAll(':', ''),
                'FINALIZADO',
            ],
        },
    ]);
}

interface RouteParams {
    params: {
        codChamado: string;
    };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const ip = obterIp(request);
        if (excedeuLimite(`validar-tudo:${ip}`, 20, 10 * 60 * 1000)) {
            return NextResponse.json(
                { error: 'Muitas solicitações. Tente novamente em alguns minutos.' },
                { status: 429 }
            );
        }

        const { codChamado } = await params;
        const codChamadoNum = parseInt(codChamado, 10);
        if (isNaN(codChamadoNum) || codChamadoNum <= 0) {
            return NextResponse.json({ error: "Parâmetro 'codChamado' inválido" }, { status: 400 });
        }

        const body = await request.json();
        const verificado = verificarLinkValidacao(body?.token);
        if (!verificado || verificado.codChamado !== codChamadoNum) {
            return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 403 });
        }

        const [chamado] = await firebirdQuery<{ STATUS_CHAMADO: string | null }>(
            `SELECT STATUS_CHAMADO FROM CHAMADO WHERE COD_CHAMADO = ?`,
            [codChamadoNum]
        );
        const statusAtual = chamado?.STATUS_CHAMADO?.trim().toUpperCase();
        if (statusAtual === 'FINALIZADO') {
            return NextResponse.json(
                { error: 'Este chamado já foi validado e não pode mais ser alterado' },
                { status: 409 }
            );
        }
        // Mesma regra do gerproj-solutii: só se finaliza a partir de
        // AGUARDANDO VALIDACAO.
        if (statusAtual !== 'AGUARDANDO VALIDACAO') {
            return NextResponse.json(
                { error: 'Este chamado não está aguardando validação' },
                { status: 409 }
            );
        }

        const now = new Date();
        const logvalcli = now.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        // OBSCLI_OS é limpo — uma observação de reprovação não faz sentido
        // ficar presa numa OS que acabou de ser aprovada em bloco.
        await firebirdExecute(
            `UPDATE OS
             SET VALCLI_OS = 'SIM', OBSCLI_OS = NULL, LOGVALCLI_OS = ?
             WHERE CHAMADO_OS = ?`,
            [logvalcli, String(codChamadoNum)]
        );

        // Igual ao fluxo "Apenas finalizar o chamado" do gerproj-solutii:
        // ao validar, o chamado também é finalizado (CHAMADO + HISTCHAMADO).
        await finalizarChamado(codChamadoNum);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('[API VALIDAR-TUDO] Erro:', error);
        return NextResponse.json(
            {
                error: 'Erro ao validar chamado',
                details: safeErrorMessage(error),
            },
            { status: 500 }
        );
    }
}
