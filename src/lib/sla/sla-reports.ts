// lib/sla/sla-reports.ts

import { calcularStatusSLA, SLA_CONFIGS } from '../sla/sla-utils';

// ==================== Gerador de Relatório Excel ====================
export async function gerarRelatorioExcel(dados: {
    chamados: any[];
    metricas: any;
    periodo: { mes: number; ano: number };
    cliente?: string;
}): Promise<Blob> {
    try {
        // Usando SheetJS (xlsx) - você precisará instalar: npm install xlsx
        const XLSX = await import('xlsx');

        // Criar workbook
        const wb = XLSX.utils.book_new();

        // ===== ABA 1: RESUMO EXECUTIVO =====
        const resumoData = [
            ['RELATÓRIO DE SLA - RESUMO EXECUTIVO'],
            [],
            ['Período:', `${String(dados.periodo.mes).padStart(2, '0')}/${dados.periodo.ano}`],
            ['Cliente:', dados.cliente || 'Todos'],
            ['Data de Geração:', new Date().toLocaleString('pt-BR')],
            [],
            ['MÉTRICAS GERAIS'],
            ['Total de Chamados', dados.metricas.totalChamados],
            ['Dentro do SLA', dados.metricas.dentroSLA],
            ['Fora do SLA', dados.metricas.foraSLA],
            ['% Cumprimento', `${dados.metricas.percentualCumprimento.toFixed(2)}%`],
            ['Tempo Médio de Resolução', `${dados.metricas.tempoMedioResolucao.toFixed(2)}h`],
            [],
            ['DESEMPENHO POR PRIORIDADE'],
            ['Prioridade', 'Total', 'Dentro SLA', 'Fora SLA', '% Cumprimento'],
        ];

        Object.entries(dados.metricas.porPrioridade).forEach(([prior, info]: [string, any]) => {
            const priorLabel = getPrioridadeLabel(Number(prior));
            resumoData.push([
                priorLabel,
                info.total,
                info.dentroSLA,
                info.total - info.dentroSLA,
                `${info.percentual.toFixed(2)}%`,
            ]);
        });

        const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);

        // Aplicar largura das colunas
        wsResumo['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo');

        // ===== ABA 2: CHAMADOS DETALHADOS =====
        const chamadosData = [
            [
                'Chamado',
                'Data',
                'Hora',
                'Cliente',
                'Assunto',
                'Prioridade',
                'Status',
                'Responsável',
                'SLA Status',
                'Tempo Decorrido (h)',
                'Tempo Prazo (h)',
                '% Usado',
                'Tempo Restante (h)',
                'Conclusão',
            ],
        ];

        dados.chamados.forEach((c) => {
            const sla = calcularStatusSLA(
                c.DATA_CHAMADO,
                c.HORA_CHAMADO,
                c.PRIOR_CHAMADO,
                c.STATUS_CHAMADO,
                c.CONCLUSAO_CHAMADO,
                'resolucao'
            );

            const config = SLA_CONFIGS[c.PRIOR_CHAMADO] || SLA_CONFIGS[100];

            chamadosData.push([
                c.COD_CHAMADO,
                new Date(c.DATA_CHAMADO).toLocaleDateString('pt-BR'),
                c.HORA_CHAMADO,
                c.NOME_CLIENTE || '',
                c.ASSUNTO_CHAMADO || '',
                getPrioridadeLabel(c.PRIOR_CHAMADO),
                c.STATUS_CHAMADO,
                c.NOME_RECURSO || 'Não atribuído',
                sla.status,
                sla.tempoDecorrido.toFixed(2),
                config.tempoResolucao,
                `${sla.percentualUsado.toFixed(2)}%`,
                sla.tempoRestante.toFixed(2),
                c.CONCLUSAO_CHAMADO
                    ? new Date(c.CONCLUSAO_CHAMADO).toLocaleDateString('pt-BR')
                    : '',
            ]);
        });

        const wsChamados = XLSX.utils.aoa_to_sheet(chamadosData);

        // Aplicar largura das colunas
        wsChamados['!cols'] = [
            { wch: 10 }, // Chamado
            { wch: 12 }, // Data
            { wch: 8 }, // Hora
            { wch: 25 }, // Cliente
            { wch: 35 }, // Assunto
            { wch: 12 }, // Prioridade
            { wch: 15 }, // Status
            { wch: 20 }, // Responsável
            { wch: 12 }, // SLA Status
            { wch: 18 }, // Tempo Decorrido
            { wch: 15 }, // Tempo Prazo
            { wch: 10 }, // % Usado
            { wch: 18 }, // Tempo Restante
            { wch: 12 }, // Conclusão
        ];

        XLSX.utils.book_append_sheet(wb, wsChamados, 'Chamados Detalhados');

        // ===== ABA 3: CHAMADOS CRÍTICOS =====
        const criticos = dados.chamados.filter((c) => {
            const sla = calcularStatusSLA(
                c.DATA_CHAMADO,
                c.HORA_CHAMADO,
                c.PRIOR_CHAMADO,
                c.STATUS_CHAMADO,
                c.CONCLUSAO_CHAMADO,
                'resolucao'
            );
            return sla.status === 'CRITICO' || sla.status === 'VENCIDO';
        });

        const criticosData = [
            ['CHAMADOS EM SITUAÇÃO CRÍTICA OU VENCIDOS'],
            [],
            [
                'Chamado',
                'Data',
                'Cliente',
                'Assunto',
                'Prioridade',
                'SLA Status',
                '% Usado',
                'Tempo Restante (h)',
            ],
        ];

        criticos.forEach((c) => {
            const sla = calcularStatusSLA(
                c.DATA_CHAMADO,
                c.HORA_CHAMADO,
                c.PRIOR_CHAMADO,
                c.STATUS_CHAMADO,
                c.CONCLUSAO_CHAMADO,
                'resolucao'
            );

            criticosData.push([
                c.COD_CHAMADO,
                new Date(c.DATA_CHAMADO).toLocaleDateString('pt-BR'),
                c.NOME_CLIENTE || '',
                c.ASSUNTO_CHAMADO || '',
                getPrioridadeLabel(c.PRIOR_CHAMADO),
                sla.status,
                `${sla.percentualUsado.toFixed(2)}%`,
                sla.tempoRestante.toFixed(2),
            ]);
        });

        const wsCriticos = XLSX.utils.aoa_to_sheet(criticosData);
        wsCriticos['!cols'] = [
            { wch: 10 },
            { wch: 12 },
            { wch: 25 },
            { wch: 35 },
            { wch: 12 },
            { wch: 12 },
            { wch: 10 },
            { wch: 18 },
        ];

        XLSX.utils.book_append_sheet(wb, wsCriticos, 'Chamados Críticos');

        // Gerar arquivo
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
    } catch (error) {
        console.error('[SLA REPORTS] Erro ao gerar Excel:', error);
        throw error;
    }
}

// ==================== Gerador de Relatório PDF ====================
export async function gerarRelatorioPDF(dados: {
    chamados: any[];
    metricas: any;
    periodo: { mes: number; ano: number };
    cliente?: string;
}): Promise<string> {
    try {
        // Retorna HTML que pode ser convertido para PDF usando jsPDF ou html2pdf
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #333;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24pt;
      color: #1e40af;
    }
    .header p {
      margin: 5px 0;
      color: #6b7280;
    }
    .section {
      margin: 20px 0;
      page-break-inside: avoid;
    }
    .section-title {
      background: #3b82f6;
      color: white;
      padding: 10px;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 15px 0;
    }
    .metric-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      background: #f9fafb;
    }
    .metric-label {
      font-size: 9pt;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .metric-value {
      font-size: 20pt;
      font-weight: bold;
      color: #1e40af;
    }
    .metric-subtitle {
      font-size: 8pt;
      color: #9ca3af;
      margin-top: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 9pt;
    }
    th {
      background: #f3f4f6;
      padding: 8px;
      text-align: left;
      border: 1px solid #d1d5db;
      font-weight: bold;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
    }
    tr:nth-child(even) { background: #f9fafb; }
    .status-ok { color: #10b981; font-weight: bold; }
    .status-alerta { color: #f59e0b; font-weight: bold; }
    .status-critico { color: #ef4444; font-weight: bold; }
    .status-vencido { color: #991b1b; font-weight: bold; }
    .progress-bar {
      background: #e5e7eb;
      height: 20px;
      border-radius: 10px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #f59e0b 75%, #ef4444 90%, #991b1b 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 9pt;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 8pt;
      color: #9ca3af;
      padding: 10px;
      border-top: 1px solid #e5e7eb;
    }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Relatório de SLA</h1>
    <p><strong>Período:</strong> ${String(dados.periodo.mes).padStart(2, '0')}/${dados.periodo.ano}</p>
    <p><strong>Cliente:</strong> ${dados.cliente || 'Todos'}</p>
    <p><strong>Data de Geração:</strong> ${new Date().toLocaleString('pt-BR')}</p>
  </div>

  <div class="section">
    <div class="section-title">📊 Resumo Executivo</div>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Total de Chamados</div>
        <div class="metric-value">${dados.metricas.totalChamados}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Dentro do SLA</div>
        <div class="metric-value" style="color: #10b981;">${dados.metricas.dentroSLA}</div>
        <div class="metric-subtitle">${dados.metricas.percentualCumprimento.toFixed(1)}% cumprimento</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Fora do SLA</div>
        <div class="metric-value" style="color: #ef4444;">${dados.metricas.foraSLA}</div>
        <div class="metric-subtitle">${((dados.metricas.foraSLA / dados.metricas.totalChamados) * 100).toFixed(1)}% do total</div>
      </div>
    </div>

    <div style="margin: 20px 0;">
      <strong>Taxa de Cumprimento do SLA:</strong>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${dados.metricas.percentualCumprimento}%;">
          ${dados.metricas.percentualCumprimento.toFixed(1)}%
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🎯 Desempenho por Prioridade</div>
    <table>
      <thead>
        <tr>
          <th>Prioridade</th>
          <th style="text-align: center;">Total</th>
          <th style="text-align: center;">Dentro SLA</th>
          <th style="text-align: center;">Fora SLA</th>
          <th style="text-align: center;">% Cumprimento</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(dados.metricas.porPrioridade)
            .map(
                ([prior, info]: [string, any]) => `
            <tr>
              <td>${getPrioridadeLabel(Number(prior))}</td>
              <td style="text-align: center;">${info.total}</td>
              <td style="text-align: center; color: #10b981; font-weight: bold;">${info.dentroSLA}</td>
              <td style="text-align: center; color: #ef4444; font-weight: bold;">${info.total - info.dentroSLA}</td>
              <td style="text-align: center; font-weight: bold;">
                <span class="${info.percentual >= 90 ? 'status-ok' : info.percentual >= 75 ? 'status-alerta' : 'status-critico'}">
                  ${info.percentual.toFixed(1)}%
                </span>
              </td>
            </tr>
          `
            )
            .join('')}
      </tbody>
    </table>
  </div>

  <div class="page-break"></div>

  <div class="section">
    <div class="section-title">📋 Chamados Detalhados (Top 50)</div>
    <table>
      <thead>
        <tr>
          <th>Chamado</th>
          <th>Data</th>
          <th>Cliente</th>
          <th>Assunto</th>
          <th>Prior.</th>
          <th>SLA</th>
          <th>% Usado</th>
        </tr>
      </thead>
      <tbody>
        ${dados.chamados
            .slice(0, 50)
            .map((c) => {
                const sla = calcularStatusSLA(
                    c.DATA_CHAMADO,
                    c.HORA_CHAMADO,
                    c.PRIOR_CHAMADO,
                    c.STATUS_CHAMADO,
                    c.CONCLUSAO_CHAMADO,
                    'resolucao'
                );

                return `
            <tr>
              <td>${c.COD_CHAMADO}</td>
              <td>${new Date(c.DATA_CHAMADO).toLocaleDateString('pt-BR')}</td>
              <td>${c.NOME_CLIENTE || '-'}</td>
              <td>${(c.ASSUNTO_CHAMADO || '').substring(0, 40)}...</td>
              <td>${getPrioridadeSimples(c.PRIOR_CHAMADO)}</td>
              <td class="status-${sla.status.toLowerCase()}">${sla.status}</td>
              <td style="text-align: center;">${sla.percentualUsado.toFixed(1)}%</td>
            </tr>
          `;
            })
            .join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Relatório gerado automaticamente pelo Sistema de Gerenciamento de Chamados</p>
  </div>
</body>
</html>
    `;

        return html;
    } catch (error) {
        console.error('[SLA REPORTS] Erro ao gerar PDF:', error);
        throw error;
    }
}

// ==================== Utilitários ====================
function getPrioridadeLabel(prior: number): string {
    const labels: Record<number, string> = {
        1: '🔴 Crítica',
        2: '🟠 Alta',
        3: '🟡 Média',
        4: '🟢 Baixa',
    };
    return labels[prior] || '⚪ Normal';
}

function getPrioridadeSimples(prior: number): string {
    const labels: Record<number, string> = {
        1: 'P1',
        2: 'P2',
        3: 'P3',
        4: 'P4',
    };
    return labels[prior] || 'P-';
}
