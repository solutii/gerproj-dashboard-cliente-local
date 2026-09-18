import { safeErrorMessage } from '@/lib/api-error';
import { verificarLinkValidacao } from '@/lib/auth/link-validacao';
import { SESSAO_COOKIE_NOME, verificarSessao } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';
import { firebirdExecute, firebirdQuery } from '../../../lib/firebird/firebird-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cod_os, concordaPagar, observacao, codCliente, linkToken } = body;

        // Validações
        if (!cod_os) {
            return NextResponse.json({ error: 'Número da OS é obrigatório' }, { status: 400 });
        }

        // Rota pública no middleware (o /validar/[token] não tem login), então
        // a autenticação é feita aqui: token do link (que prova a posse de UM
        // chamado) ou sessão. Sem nenhum dos dois, 401. Com sessão de cliente,
        // o codCliente vem da sessão, ignorando o do body.
        let codClienteEfetivo = codCliente;
        let linkVerificado: { codChamado: number; codCliente: string } | null = null;
        if (linkToken) {
            linkVerificado = verificarLinkValidacao(linkToken);
            if (!linkVerificado) {
                return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 403 });
            }
            codClienteEfetivo = linkVerificado.codCliente;
        } else {
            const sessao = await verificarSessao(request.cookies.get(SESSAO_COOKIE_NOME)?.value);
            if (!sessao) {
                return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
            }
            if (sessao.loginType === 'cliente') codClienteEfetivo = sessao.codCliente;
        }

        if (!codClienteEfetivo) {
            return NextResponse.json(
                { error: "Parâmetro 'codCliente' é obrigatório" },
                { status: 400 }
            );
        }

        // A OS precisa pertencer a um chamado do mesmo cliente que está
        // validando — sem isso, qualquer cliente logado poderia aprovar ou
        // reprovar o faturamento de uma OS de outro cliente só sabendo (ou
        // adivinhando) o número dela.
        const donoOS = await firebirdQuery<{
            COD_CLIENTE: number;
            COD_CHAMADO: number;
            STATUS_CHAMADO: string | null;
        }>(
            `SELECT CHAMADO.COD_CLIENTE, CHAMADO.COD_CHAMADO, CHAMADO.STATUS_CHAMADO
             FROM OS
             JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
             WHERE OS.COD_OS = ?`,
            [cod_os]
        );

        if (donoOS.length === 0) {
            return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
        }

        if (String(donoOS[0].COD_CLIENTE) !== String(codClienteEfetivo)) {
            return NextResponse.json(
                { error: 'Você não tem permissão para validar esta OS' },
                { status: 403 }
            );
        }

        // Pelo link do e-mail, o acesso é a UM chamado e só enquanto ele não
        // foi finalizado — depois de validado, o link não permite reverter.
        if (linkVerificado) {
            if (Number(donoOS[0].COD_CHAMADO) !== linkVerificado.codChamado) {
                return NextResponse.json(
                    { error: 'Você não tem permissão para validar esta OS' },
                    { status: 403 }
                );
            }
            if (donoOS[0].STATUS_CHAMADO?.trim().toUpperCase() === 'FINALIZADO') {
                return NextResponse.json(
                    { error: 'Este chamado já foi validado e não pode mais ser alterado' },
                    { status: 409 }
                );
            }
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
