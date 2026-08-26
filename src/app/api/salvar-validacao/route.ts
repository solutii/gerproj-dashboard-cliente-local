import { safeErrorMessage } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import { firebirdExecute, firebirdQuery } from '../../../lib/firebird/firebird-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cod_os, concordaPagar, observacao, codCliente } = body;

        // Validações
        if (!cod_os) {
            return NextResponse.json({ error: 'Número da OS é obrigatório' }, { status: 400 });
        }

        if (!codCliente) {
            return NextResponse.json(
                { error: "Parâmetro 'codCliente' é obrigatório" },
                { status: 400 }
            );
        }

        // A OS precisa pertencer a um chamado do mesmo cliente que está
        // validando — sem isso, qualquer cliente logado poderia aprovar ou
        // reprovar o faturamento de uma OS de outro cliente só sabendo (ou
        // adivinhando) o número dela.
        const donoOS = await firebirdQuery<{ COD_CLIENTE: number }>(
            `SELECT CHAMADO.COD_CLIENTE
             FROM OS
             JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
             WHERE OS.COD_OS = ?`,
            [cod_os]
        );

        if (donoOS.length === 0) {
            return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
        }

        if (String(donoOS[0].COD_CLIENTE) !== String(codCliente)) {
            return NextResponse.json(
                { error: 'Você não tem permissão para validar esta OS' },
                { status: 403 }
            );
        }

        if (!concordaPagar && !observacao?.trim()) {
            return NextResponse.json(
                { error: 'Observação é obrigatória quando não concorda em pagar' },
                { status: 400 }
            );
        }

        // Prepara os valores
        const valcli = concordaPagar ? 'SIM' : 'NAO';
        const obscli = observacao?.trim() || null;

        // Data e hora atual no formato DD/MM/YYYY HH:MM:SS
        const now = new Date();
        const logvalcli = now.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        const MAX_OBS_LENGTH = 195; // mesmo valor do maxLength do frontend

        if (obscli && obscli.length > MAX_OBS_LENGTH) {
            return NextResponse.json(
                { error: `Observação não pode ter mais de ${MAX_OBS_LENGTH} caracteres` },
                { status: 400 }
            );
        }

        // Query de UPDATE
        const sql = `
      UPDATE OS
      SET VALCLI_OS = ?,
          OBSCLI_OS = ?,
          LOGVALCLI_OS = ?
      WHERE COD_OS = ?
    `;

        await firebirdExecute(sql, [valcli, obscli, logvalcli, cod_os]);

        return NextResponse.json({
            success: true,
            message: 'Validação salva com sucesso',
            data: {
                cod_os: cod_os,
                valcli_os: valcli,
                obscli_os: obscli,
                logvalcli_os: logvalcli,
            },
        });
    } catch (error) {
        console.error('Erro ao salvar validação:', error);
        return NextResponse.json(
            {
                error: 'Erro ao salvar validação no banco de dados',
                details: safeErrorMessage(error),
            },
            { status: 500 }
        );
    }
}
