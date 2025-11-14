import { NextRequest, NextResponse } from 'next/server';
import { firebirdQuery } from '../../../lib/firebird/firebird-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cod_os, concordaPagar, observacao } = body;

    // Validações
    if (!cod_os) {
      return NextResponse.json(
        { error: 'Número da OS é obrigatório' },
        { status: 400 }
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

    // Query de UPDATE
    const sql = `
      UPDATE OS 
      SET VALCLI_OS = ?, 
          OBSCLI_OS = ?, 
          LOGVALCLI_OS = ?
      WHERE COD_OS = ?
    `;

    await firebirdQuery(sql, [valcli, obscli, logvalcli, cod_os]);

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
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}