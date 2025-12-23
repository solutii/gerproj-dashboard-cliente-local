import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

interface SaldoMensal {
  mes: number;
  ano: number;
  codCliente: number;
  nomeCliente: string;
  horasContratadas: number;
  horasExecutadas: number;
  saldo: number;
  mesesDesdeApuracao: number;
  expirado: boolean;
  validoAte: string;
  status: 'disponivel' | 'expirado' | 'zerado' | 'negativo';
}

function calcularMesesDiferenca(
  mesOrigem: number,
  anoOrigem: number,
  mesAtual: number,
  anoAtual: number,
): number {
  return (anoAtual - anoOrigem) * 12 + (mesAtual - mesOrigem);
}

async function buscarHorasMes(
  codCliente: string,
  mes: number,
  ano: number,
): Promise<{
  contratadas: number;
  executadas: number;
  nomeCliente: string;
}> {
  const mesFormatado = mes.toString().padStart(2, '0');
  const dataInicio = `01.${mesFormatado}.${ano}`;

  const dataFim =
    mes === 12
      ? `01.01.${ano + 1}`
      : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

  const sql = `
    SELECT 
      CLIENTE.NOME_CLIENTE,
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
    parseInt(codCliente),
  ]);

  let maxLimmes = 0;
  let horasExecutadas = 0;
  let nomeCliente = '';

  if (result && result.length > 0) {
    nomeCliente = result[0].NOME_CLIENTE || '';

    for (const row of result) {
      if (row.LIMMES_TAREFA && row.LIMMES_TAREFA > maxLimmes) {
        maxLimmes = row.LIMMES_TAREFA;
      }

      if (row.HRINI_OS && row.HRFIM_OS) {
        const hrIni = row.HRINI_OS.toString().padStart(4, '0');
        const hrFim = row.HRFIM_OS.toString().padStart(4, '0');

        const minInicio =
          parseInt(hrIni.substring(0, 2)) * 60 +
          parseInt(hrIni.substring(2, 4));
        const minFim =
          parseInt(hrFim.substring(0, 2)) * 60 +
          parseInt(hrFim.substring(2, 4));

        let diff = minFim - minInicio;
        if (diff < 0) diff += 1440;

        horasExecutadas += diff / 60;
      }
    }
  }

  return {
    contratadas: Math.round(maxLimmes * 100) / 100,
    executadas: Math.round(horasExecutadas * 100) / 100,
    nomeCliente,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const isAdmin = searchParams.get('isAdmin') === 'true';
    const codCliente = searchParams.get('codCliente')?.trim();
    const mesAtual = Number(searchParams.get('mes'));
    const anoAtual = Number(searchParams.get('ano'));
    const mesesHistorico = Number(searchParams.get('mesesHistorico')) || 6;

    if (!codCliente || !mesAtual || !anoAtual) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: codCliente, mes, ano' },
        { status: 400 },
      );
    }

    const historico: SaldoMensal[] = [];

    // Buscar histórico dos últimos N meses
    for (let i = mesesHistorico - 1; i >= 0; i--) {
      let mes = mesAtual - i;
      let ano = anoAtual;

      while (mes <= 0) {
        mes += 12;
        ano -= 1;
      }

      const { contratadas, executadas, nomeCliente } = await buscarHorasMes(
        codCliente,
        mes,
        ano,
      );

      const saldo = contratadas - executadas;
      const mesesDesdeApuracao = calcularMesesDiferenca(
        mes,
        ano,
        mesAtual,
        anoAtual,
      );

      // Saldo expira após 2 meses (pode usar no mês apurado + 2 meses seguintes)
      const expirado = mesesDesdeApuracao > 2;

      // Último mês em que o saldo pode ser usado
      let mesValidoAte = mes + 2;
      let anoValidoAte = ano;

      while (mesValidoAte > 12) {
        mesValidoAte -= 12;
        anoValidoAte += 1;
      }

      // Determinar status
      let status: 'disponivel' | 'expirado' | 'zerado' | 'negativo' =
        'disponivel';

      // 1. PRIMEIRO: verificar se é negativo (débitos nunca expiram)
      if (saldo < -0.01) {
        status = 'negativo';
      }
      // 2. SEGUNDO: verificar se é zerado
      else if (Math.abs(saldo) < 0.01) {
        status = 'zerado';
      }
      // 3. TERCEIRO: verificar se expirou (só para saldos positivos)
      else if (expirado) {
        status = 'expirado';
      }

      // Definir validoAte baseado no status
      const validoAte =
        status === 'negativo'
          ? '-'
          : `${mesValidoAte.toString().padStart(2, '0')}/${anoValidoAte}`;

      historico.push({
        mes,
        ano,
        codCliente: parseInt(codCliente),
        nomeCliente,
        horasContratadas: contratadas,
        horasExecutadas: executadas,
        saldo: Math.round(saldo * 100) / 100,
        mesesDesdeApuracao,
        expirado,
        validoAte, // Agora será "-" para débitos
        status,
      });
    }

    // Calcular resumo
    const saldosPositivos = historico.filter((h) => !h.expirado && h.saldo > 0);

    const saldosNegativos = historico.filter((h) => !h.expirado && h.saldo < 0);

    const saldoTotalDisponivel = saldosPositivos.reduce(
      (acc, h) => acc + h.saldo,
      0,
    );

    const debitoTotal = Math.abs(
      saldosNegativos.reduce((acc, h) => acc + h.saldo, 0),
    );

    const totalContratadas = historico.reduce(
      (acc, h) => acc + h.horasContratadas,
      0,
    );

    const totalExecutadas = historico.reduce(
      (acc, h) => acc + h.horasExecutadas,
      0,
    );

    return NextResponse.json({
      mesAtual,
      anoAtual,
      codCliente,
      nomeCliente: historico[0]?.nomeCliente || '',
      saldoTotalDisponivel: Math.round(saldoTotalDisponivel * 100) / 100,
      debitoTotal: Math.round(debitoTotal * 100) / 100,
      resumo: {
        totalContratadas: Math.round(totalContratadas * 100) / 100,
        totalExecutadas: Math.round(totalExecutadas * 100) / 100,
        saldoGeral:
          Math.round((totalContratadas - totalExecutadas) * 100) / 100,
        mesesComSaldoPositivo: saldosPositivos.length,
        mesesComSaldoNegativo: saldosNegativos.length,
        mesesExpirados: historico.filter((h) => h.expirado).length,
      },
      historico,
    });
  } catch (error) {
    console.error('[API SALDO HISTÓRICO] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar histórico de saldo' },
      { status: 500 },
    );
  }
}
