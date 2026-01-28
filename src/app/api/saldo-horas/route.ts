// app/api/saldo-horas/route.ts
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

interface SaldoMensal {
    mes: number;
    ano: number;
    codCliente: number;
    nomeCliente: string;
    horasContratadas: number;
    horasExecutadas: number;
    saldoBruto: number; // Saldo antes da compensação
    saldoLiquido: number; // Saldo após compensação
    compensacoes: Compensacao[]; // Novo campo
    mesesDesdeApuracao: number;
    expirado: boolean;
    validoAte: string;
    status: 'disponivel' | 'expirado' | 'zerado' | 'negativo' | 'compensado';
}

interface Compensacao {
    mesOrigem: string; // "11/2025"
    horasCompensadas: number; // 4
    tipoCompensacao: 'credito_utilizado' | 'debito_compensado';
}

function calcularMesesDiferenca(
    mesOrigem: number,
    anoOrigem: number,
    mesAtual: number,
    anoAtual: number
): number {
    return (anoAtual - anoOrigem) * 12 + (mesAtual - mesOrigem);
}

async function buscarHorasMes(
    codCliente: string,
    mes: number,
    ano: number
): Promise<{
    contratadas: number;
    executadas: number;
    nomeCliente: string;
}> {
    const mesFormatado = mes.toString().padStart(2, '0');
    const dataInicio = `01.${mesFormatado}.${ano}`;

    const dataFim =
        mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

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
      AND UPPER(OS.FATURADO_OS) <> 'NAO'  -- ✅ ADICIONAR ESTA LINHA
  `;

    const result = await firebirdQuery(sql, [dataInicio, dataFim, parseInt(codCliente)]);

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
                    parseInt(hrIni.substring(0, 2)) * 60 + parseInt(hrIni.substring(2, 4));
                const minFim =
                    parseInt(hrFim.substring(0, 2)) * 60 + parseInt(hrFim.substring(2, 4));

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

// Nova função para processar compensações
function processarCompensacoes(
    historico: SaldoMensal[],
    mesAtual: number,
    anoAtual: number
): SaldoMensal[] {
    // Ordenar do mais antigo para o mais recente
    const historicoOrdenado = [...historico].sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        return a.mes - b.mes;
    });

    // Inicializar campos
    historicoOrdenado.forEach((registro) => {
        registro.compensacoes = [];
        registro.saldoLiquido = registro.saldoBruto;
    });

    // Pool de créditos disponíveis (acumula conforme processa)
    const poolCreditos: Array<{
        mes: number;
        ano: number;
        saldoRestante: number;
        indice: number;
        mesValidoAte: number;
        anoValidoAte: number;
    }> = [];

    // Processar mês a mês em ordem cronológica
    historicoOrdenado.forEach((registro, idx) => {
        const mesRegistro = registro.mes;
        const anoRegistro = registro.ano;

        // 1. Remover créditos expirados do pool (que não podem mais ser usados neste mês)
        const creditosValidos = poolCreditos.filter((credito) => {
            // Crédito expira se o mês atual é APÓS o mês válido até
            const creditoExpirou =
                anoRegistro > credito.anoValidoAte ||
                (anoRegistro === credito.anoValidoAte && mesRegistro > credito.mesValidoAte);

            return !creditoExpirou && credito.saldoRestante > 0.01;
        });

        // 2. Se o registro atual é um CRÉDITO (saldo positivo) e não expirou
        if (registro.saldoBruto > 0.01 && !registro.expirado) {
            // Calcular até quando este crédito é válido (mês apurado + 2 meses)
            let mesValido = mesRegistro + 2;
            let anoValido = anoRegistro;

            while (mesValido > 12) {
                mesValido -= 12;
                anoValido += 1;
            }

            // Adicionar ao pool de créditos disponíveis
            creditosValidos.push({
                mes: mesRegistro,
                ano: anoRegistro,
                saldoRestante: registro.saldoBruto,
                indice: idx,
                mesValidoAte: mesValido,
                anoValidoAte: anoValido,
            });
        }

        // 3. Se o registro atual é um DÉBITO (saldo negativo)
        if (registro.saldoBruto < -0.01) {
            let debitoRestante = Math.abs(registro.saldoBruto);

            // Tentar compensar com créditos disponíveis (FIFO - usa os mais antigos primeiro)
            for (const credito of creditosValidos) {
                if (debitoRestante <= 0.01) break;
                if (credito.saldoRestante <= 0.01) continue;

                const horasCompensadas = Math.min(debitoRestante, credito.saldoRestante);

                // Registrar compensação no débito
                registro.compensacoes.push({
                    mesOrigem: `${credito.mes.toString().padStart(2, '0')}/${credito.ano}`,
                    horasCompensadas: Math.round(horasCompensadas * 100) / 100,
                    tipoCompensacao: 'debito_compensado',
                });

                // Registrar compensação no crédito
                historicoOrdenado[credito.indice].compensacoes.push({
                    mesOrigem: `${mesRegistro.toString().padStart(2, '0')}/${anoRegistro}`,
                    horasCompensadas: Math.round(horasCompensadas * 100) / 100,
                    tipoCompensacao: 'credito_utilizado',
                });

                // Atualizar saldos
                historicoOrdenado[credito.indice].saldoLiquido -= horasCompensadas;
                credito.saldoRestante -= horasCompensadas;
                debitoRestante -= horasCompensadas;
            }

            // Atualizar saldo líquido do débito
            // Se debitoRestante > 0 = Cliente DEVE PAGAR
            registro.saldoLiquido = -debitoRestante;
        }

        // Atualizar pool para próxima iteração
        poolCreditos.length = 0;
        poolCreditos.push(...creditosValidos);
    });

    // Atualizar status baseado no saldo líquido final
    historicoOrdenado.forEach((registro) => {
        // Se teve compensações
        if (registro.compensacoes.length > 0) {
            if (Math.abs(registro.saldoLiquido) < 0.01) {
                registro.status = 'compensado';
            } else if (registro.saldoLiquido < -0.01) {
                registro.status = 'negativo'; // Débito parcialmente compensado
            } else if (registro.saldoLiquido > 0.01 && !registro.expirado) {
                registro.status = 'disponivel'; // Crédito parcialmente usado
            } else if (registro.saldoLiquido > 0.01 && registro.expirado) {
                registro.status = 'expirado';
            }
        }
    });

    return historicoOrdenado;
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
                { status: 400 }
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
                ano
            );

            const saldoBruto = contratadas - executadas;
            const mesesDesdeApuracao = calcularMesesDiferenca(mes, ano, mesAtual, anoAtual);

            // REGRA IMPORTANTE: Débitos NUNCA expiram, apenas créditos
            const expirado = mesesDesdeApuracao > 2 && saldoBruto > 0;

            let mesValidoAte = mes + 2;
            let anoValidoAte = ano;

            while (mesValidoAte > 12) {
                mesValidoAte -= 12;
                anoValidoAte += 1;
            }

            let status: 'disponivel' | 'expirado' | 'zerado' | 'negativo' | 'compensado' =
                'disponivel';

            if (saldoBruto < -0.01) {
                status = 'negativo';
            } else if (Math.abs(saldoBruto) < 0.01) {
                status = 'zerado';
            } else if (expirado) {
                status = 'expirado';
            }

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
                saldoBruto: Math.round(saldoBruto * 100) / 100,
                saldoLiquido: Math.round(saldoBruto * 100) / 100, // Será recalculado
                compensacoes: [],
                mesesDesdeApuracao,
                expirado,
                validoAte,
                status,
            });
        }

        // PROCESSAR COMPENSAÇÕES (passar mesAtual e anoAtual)
        const historicoComCompensacoes = processarCompensacoes(historico, mesAtual, anoAtual);

        // Calcular resumo com base nos saldos líquidos VÁLIDOS
        const saldosPositivos = historicoComCompensacoes.filter(
            (h) => !h.expirado && h.saldoLiquido > 0.01
        );

        // DÉBITOS NUNCA EXPIRAM - incluir todos os débitos independente do tempo
        const saldosNegativos = historicoComCompensacoes.filter((h) => h.saldoLiquido < -0.01);

        const saldoTotalDisponivel = saldosPositivos.reduce((acc, h) => acc + h.saldoLiquido, 0);

        const debitoTotal = Math.abs(saldosNegativos.reduce((acc, h) => acc + h.saldoLiquido, 0));

        // SALDO GERAL: saldos positivos não expirados + TODOS os débitos (não expiram)
        const saldoGeralPositivo = historicoComCompensacoes
            .filter((h) => !h.expirado && h.saldoLiquido > 0.01)
            .reduce((acc, h) => acc + h.saldoLiquido, 0);

        const saldoGeralNegativo = historicoComCompensacoes
            .filter((h) => h.saldoLiquido < -0.01)
            .reduce((acc, h) => acc + h.saldoLiquido, 0);

        const saldoGeral = saldoGeralPositivo + saldoGeralNegativo;

        // Totais de horas: não expirados + débitos (que nunca expiram)
        const totalContratadas = historicoComCompensacoes
            .filter((h) => !h.expirado || h.saldoLiquido < -0.01)
            .reduce((acc, h) => acc + h.horasContratadas, 0);

        const totalExecutadas = historicoComCompensacoes
            .filter((h) => !h.expirado || h.saldoLiquido < -0.01)
            .reduce((acc, h) => acc + h.horasExecutadas, 0);

        return NextResponse.json({
            mesAtual,
            anoAtual,
            codCliente,
            nomeCliente: historicoComCompensacoes[0]?.nomeCliente || '',
            saldoTotalDisponivel: Math.round(saldoTotalDisponivel * 100) / 100,
            debitoTotal: Math.round(debitoTotal * 100) / 100,
            resumo: {
                totalContratadas: Math.round(totalContratadas * 100) / 100,
                totalExecutadas: Math.round(totalExecutadas * 100) / 100,
                saldoGeral: Math.round(saldoGeral * 100) / 100,
                mesesComSaldoPositivo: saldosPositivos.length,
                mesesComSaldoNegativo: saldosNegativos.length,
                mesesExpirados: historicoComCompensacoes.filter((h) => h.expirado).length,
                mesesCompensados: historicoComCompensacoes.filter((h) => h.compensacoes.length > 0)
                    .length,
            },
            historico: historicoComCompensacoes,
        });
    } catch (error) {
        console.error('[API SALDO HISTÓRICO] Erro:', error);
        return NextResponse.json({ error: 'Erro ao buscar histórico de saldo' }, { status: 500 });
    }
}
