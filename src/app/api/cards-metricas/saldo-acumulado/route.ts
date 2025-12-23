// ==================== PARTE 1: Nova API para Saldo Acumulado ====================
// Arquivo: app/api/cards-metricas/saldo-acumulado/route.ts

import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

interface SaldoMensal {
  mes: number;
  ano: number;
  horasContratadas: number;
  horasExecutadas: number;
  saldo: number;
  mesesDesdeApuracao: number;
  expirado: boolean;
  expiraEm: string;
}

function calcularMesesDiferenca(
  mesOrigem: number,
  anoOrigem: number,
  mesAtual: number,
  anoAtual: number
): number {
  return (anoAtual - anoOrigem) * 12 + (mesAtual - mesOrigem);
}

function obterMesAnterior(mes: number, ano: number) {
  if (mes === 1) {
    return { mes: 12, ano: ano - 1 };
  }
  return { mes: mes - 1, ano };
}

async function buscarHorasMes(
  codCliente: string,
  mes: number,
  ano: number,
  isAdmin: boolean
): Promise<{ contratadas: number; executadas: number }> {
  const mesFormatado = mes.toString().padStart(2, '0');
  const dataInicio = `01.${mesFormatado}.${ano}`;
  
  const dataFim = mes === 12
    ? `01.01.${ano + 1}`
    : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

  let sql = `
    SELECT 
      TAREFA.LIMMES_TAREFA,
      OS.HRINI_OS,
      OS.HRFIM_OS
    FROM OS
    INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
    INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
    INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
    WHERE OS.DTINI_OS >= ? 
      AND OS.DTINI_OS < ?
      AND TAREFA.EXIBECHAM_TAREFA = 1
      AND OS.CHAMADO_OS IS NOT NULL
      AND TRIM(OS.CHAMADO_OS) <> ''
      AND CLIENTE.COD_CLIENTE = ?
  `;

  const result = await firebirdQuery(sql, [
    dataInicio,
    dataFim,
    parseInt(codCliente)
  ]);

  let maxLimmes = 0;
  let horasExecutadas = 0;

  if (result && result.length > 0) {
    for (const row of result) {
      if (row.LIMMES_TAREFA && row.LIMMES_TAREFA > maxLimmes) {
        maxLimmes = row.LIMMES_TAREFA;
      }

      if (row.HRINI_OS && row.HRFIM_OS) {
        const hrIni = row.HRINI_OS.toString().padStart(4, '0');
        const hrFim = row.HRFIM_OS.toString().padStart(4, '0');
        
        const minInicio = parseInt(hrIni.substring(0, 2)) * 60 + parseInt(hrIni.substring(2, 4));
        const minFim = parseInt(hrFim.substring(0, 2)) * 60 + parseInt(hrFim.substring(2, 4));
        
        let diff = minFim - minInicio;
        if (diff < 0) diff += 1440;
        
        horasExecutadas += diff / 60;
      }
    }
  }

  return {
    contratadas: Math.round(maxLimmes * 100) / 100,
    executadas: Math.round(horasExecutadas * 100) / 100
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const codCliente = searchParams.get('codCliente')?.trim();
    const mesAtual = Number(searchParams.get('mes'));
    const anoAtual = Number(searchParams.get('ano'));

    if (!codCliente || !mesAtual || !anoAtual) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: codCliente, mes, ano' },
        { status: 400 }
      );
    }

    // Buscar dados dos últimos 3 meses (incluindo atual)
    const meses: SaldoMensal[] = [];
    
    for (let i = 2; i >= 0; i--) {
      let mes = mesAtual - i;
      let ano = anoAtual;
      
      while (mes <= 0) {
        mes += 12;
        ano -= 1;
      }

      const { contratadas, executadas } = await buscarHorasMes(
        codCliente,
        mes,
        ano,
        isAdmin
      );

      const saldo = contratadas - executadas;
      const mesesDesdeApuracao = calcularMesesDiferenca(mes, ano, mesAtual, anoAtual);
      
      // Saldo expira após 2 meses (pode usar no mês atual + 2 posteriores)
      const expirado = mesesDesdeApuracao > 2;
      
      let mesExpiracao = mes + 3;
      let anoExpiracao = ano;
      
      if (mesExpiracao > 12) {
        mesExpiracao -= 12;
        anoExpiracao += 1;
      }

      meses.push({
        mes,
        ano,
        horasContratadas: contratadas,
        horasExecutadas: executadas,
        saldo: Math.round(saldo * 100) / 100,
        mesesDesdeApuracao,
        expirado,
        expiraEm: `${mesExpiracao.toString().padStart(2, '0')}/${anoExpiracao}`
      });
    }

    // Calcular saldo disponível (apenas meses não expirados com saldo positivo)
    const saldosDisponiveis = meses.filter(m => !m.expirado && m.saldo > 0);
    const saldoTotal = saldosDisponiveis.reduce((acc, m) => acc + m.saldo, 0);

    return NextResponse.json({
      mesAtual,
      anoAtual,
      saldoTotalDisponivel: Math.round(saldoTotal * 100) / 100,
      historico: meses,
      saldosAtivos: saldosDisponiveis
    });

  } catch (error) {
    console.error('[API SALDO ACUMULADO] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao calcular saldo acumulado' },
      { status: 500 }
    );
  }
}