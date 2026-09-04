// src/app/api/chamados/[codChamado]/validar-tudo/route.ts
//
// Aprova TODAS as OS's de um chamado de uma vez (checkbox "Validar chamado"
// da tela /validar/[token]) — sobrescreve inclusive alguma OS que já
// estivesse reprovada, por decisão explícita do fluxo. Exige um token de
// link-validacao válido para o MESMO chamado — não aceita um codCliente
// solto, diferente de /api/salvar-validacao (que também aceita chamadas de
// dentro da aplicação já logada).
import { safeErrorMessage } from '@/lib/api-error';
import { verificarLinkValidacao } from '@/lib/auth/link-validacao';
import { firebirdExecute } from '@/lib/firebird/firebird-client';
import { excedeuLimite, obterIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

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
