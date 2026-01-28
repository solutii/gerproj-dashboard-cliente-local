// src/components/sla/Painel_Configuracao.tsx

import { AlertTriangle, Bell, Clock, Download, FileText, Save, Settings } from 'lucide-react';
import { useState } from 'react';

type Message = { type: 'success' | 'error'; text: string } | null;

const SLAConfigPanel = () => {
    const [activeTab, setActiveTab] = useState('sla');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<Message>(null);

    // Configurações SLA
    const [slaConfig, setSlaConfig] = useState({
        1: { tempoResposta: 2, tempoResolucao: 8 },
        2: { tempoResposta: 4, tempoResolucao: 16 },
        3: { tempoResposta: 8, tempoResolucao: 24 },
        4: { tempoResposta: 16, tempoResolucao: 48 },
    });

    // Horário comercial
    const [horarioComercial, setHorarioComercial] = useState({
        inicio: 8,
        fim: 18,
        diasUteis: [1, 2, 3, 4, 5],
    });

    // Notificações
    const [notificacoes, setNotificacoes] = useState({
        ativo: true,
        emailsAlerta: 'suporte@empresa.com',
        emailsCriticos: 'gerente@empresa.com',
        emailsVencidos: 'diretoria@empresa.com',
        intervaloVerificacao: 60,
    });

    const handleSaveSLA = async () => {
        setSaving(true);
        setMessage(null);

        try {
            // Simular salvamento
            await new Promise((resolve) => setTimeout(resolve, 1000));

            setMessage({ type: 'success', text: 'Configurações de SLA salvas com sucesso!' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async (format: string) => {
        try {
            // Chamar API para export
            const params = new URLSearchParams({
                mes: String(new Date().getMonth() + 1),
                ano: String(new Date().getFullYear()),
                isAdmin: 'true',
                export: format,
            });

            const url = `/api/chamados/sla-integrado?${params}`;
            window.open(url, '_blank');

            setMessage({
                type: 'success',
                text: `Relatório ${format.toUpperCase()} gerado com sucesso!`,
            });
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao gerar relatório' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-5xl">
                {/* Cabeçalho */}
                <div className="mb-8">
                    <div className="mb-2 flex items-center gap-3">
                        <Settings className="h-8 w-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-900">Configurações de SLA</h1>
                    </div>
                    <p className="text-gray-600">
                        Configure os parâmetros de Service Level Agreement
                    </p>
                </div>

                {/* Mensagem de feedback */}
                {message && (
                    <div
                        className={`mb-6 rounded-lg p-4 ${
                            message.type === 'success'
                                ? 'border border-green-200 bg-green-50 text-green-800'
                                : 'border border-red-200 bg-red-50 text-red-800'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-6 rounded-lg bg-white shadow-sm">
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('sla')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                                activeTab === 'sla'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Clock className="h-5 w-5" />
                            Tempos de SLA
                        </button>
                        <button
                            onClick={() => setActiveTab('horario')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                                activeTab === 'horario'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Clock className="h-5 w-5" />
                            Horário Comercial
                        </button>
                        <button
                            onClick={() => setActiveTab('notificacoes')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                                activeTab === 'notificacoes'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Bell className="h-5 w-5" />
                            Notificações
                        </button>
                        <button
                            onClick={() => setActiveTab('relatorios')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                                activeTab === 'relatorios'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <FileText className="h-5 w-5" />
                            Relatórios
                        </button>
                    </div>

                    <div className="p-6">
                        {/* Tab: Tempos de SLA */}
                        {activeTab === 'sla' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                                        Configuração de Prazos por Prioridade
                                    </h3>
                                    <p className="mb-6 text-sm text-gray-600">
                                        Defina os tempos de resposta e resolução em horas para cada
                                        nível de prioridade.
                                    </p>
                                </div>

                                {Object.entries(slaConfig).map(([prior, config]) => (
                                    <div
                                        key={prior}
                                        className="rounded-lg border border-gray-200 p-6"
                                    >
                                        <div className="mb-4 flex items-center justify-between">
                                            <h4 className="font-semibold text-gray-900">
                                                Prioridade {prior} -{' '}
                                                {prior === '1'
                                                    ? '🔴 Crítica'
                                                    : prior === '2'
                                                      ? '🟠 Alta'
                                                      : prior === '3'
                                                        ? '🟡 Média'
                                                        : '🟢 Baixa'}
                                            </h4>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                                    Tempo de Resposta (horas)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0.5"
                                                    step="0.5"
                                                    value={config.tempoResposta}
                                                    onChange={(e) =>
                                                        setSlaConfig({
                                                            ...slaConfig,
                                                            [prior]: {
                                                                ...config,
                                                                tempoResposta: Number(
                                                                    e.target.value
                                                                ),
                                                            },
                                                        })
                                                    }
                                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                                    Tempo de Resolução (horas)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0.5"
                                                    step="0.5"
                                                    value={config.tempoResolucao}
                                                    onChange={(e) =>
                                                        setSlaConfig({
                                                            ...slaConfig,
                                                            [prior]: {
                                                                ...config,
                                                                tempoResolucao: Number(
                                                                    e.target.value
                                                                ),
                                                            },
                                                        })
                                                    }
                                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={handleSaveSLA}
                                    disabled={saving}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                                >
                                    <Save className="h-5 w-5" />
                                    {saving ? 'Salvando...' : 'Salvar Configurações'}
                                </button>
                            </div>
                        )}

                        {/* Tab: Horário Comercial */}
                        {activeTab === 'horario' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                                        Horário Comercial
                                    </h3>
                                    <p className="mb-6 text-sm text-gray-600">
                                        O SLA considera apenas horas úteis dentro do horário
                                        comercial definido.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Hora de Início
                                        </label>
                                        <select
                                            value={horarioComercial.inicio}
                                            onChange={(e) =>
                                                setHorarioComercial({
                                                    ...horarioComercial,
                                                    inicio: Number(e.target.value),
                                                })
                                            }
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i}>
                                                    {i}:00
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Hora de Término
                                        </label>
                                        <select
                                            value={horarioComercial.fim}
                                            onChange={(e) =>
                                                setHorarioComercial({
                                                    ...horarioComercial,
                                                    fim: Number(e.target.value),
                                                })
                                            }
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i}>
                                                    {i}:00
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-3 block text-sm font-medium text-gray-700">
                                        Dias Úteis
                                    </label>
                                    <div className="flex gap-3">
                                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(
                                            (dia, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        const newDias =
                                                            horarioComercial.diasUteis.includes(i)
                                                                ? horarioComercial.diasUteis.filter(
                                                                      (d) => d !== i
                                                                  )
                                                                : [
                                                                      ...horarioComercial.diasUteis,
                                                                      i,
                                                                  ];
                                                        setHorarioComercial({
                                                            ...horarioComercial,
                                                            diasUteis: newDias,
                                                        });
                                                    }}
                                                    className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                                                        horarioComercial.diasUteis.includes(i)
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                    }`}
                                                >
                                                    {dia}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveSLA}
                                    disabled={saving}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                                >
                                    <Save className="h-5 w-5" />
                                    {saving ? 'Salvando...' : 'Salvar Horário'}
                                </button>
                            </div>
                        )}

                        {/* Tab: Notificações */}
                        {activeTab === 'notificacoes' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                                        Configuração de Notificações
                                    </h3>
                                    <p className="mb-6 text-sm text-gray-600">
                                        Configure alertas automáticos quando chamados atingirem
                                        limites críticos de SLA.
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <input
                                        type="checkbox"
                                        checked={notificacoes.ativo}
                                        onChange={(e) =>
                                            setNotificacoes({
                                                ...notificacoes,
                                                ativo: e.target.checked,
                                            })
                                        }
                                        className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <label className="font-medium text-gray-900">
                                        Ativar notificações automáticas
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            <AlertTriangle className="mr-1 inline h-4 w-4 text-yellow-500" />
                                            Emails para Alertas (75-90% do SLA)
                                        </label>
                                        <input
                                            type="text"
                                            value={notificacoes.emailsAlerta}
                                            onChange={(e) =>
                                                setNotificacoes({
                                                    ...notificacoes,
                                                    emailsAlerta: e.target.value,
                                                })
                                            }
                                            placeholder="email1@empresa.com, email2@empresa.com"
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            <AlertTriangle className="mr-1 inline h-4 w-4 text-orange-500" />
                                            Emails para Críticos (90-100% do SLA)
                                        </label>
                                        <input
                                            type="text"
                                            value={notificacoes.emailsCriticos}
                                            onChange={(e) =>
                                                setNotificacoes({
                                                    ...notificacoes,
                                                    emailsCriticos: e.target.value,
                                                })
                                            }
                                            placeholder="gerente@empresa.com"
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            <AlertTriangle className="mr-1 inline h-4 w-4 text-red-600" />
                                            Emails para SLA Vencido (&gt;100%)
                                        </label>
                                        <input
                                            type="text"
                                            value={notificacoes.emailsVencidos}
                                            onChange={(e) =>
                                                setNotificacoes({
                                                    ...notificacoes,
                                                    emailsVencidos: e.target.value,
                                                })
                                            }
                                            placeholder="diretoria@empresa.com"
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Intervalo de Verificação (minutos)
                                        </label>
                                        <select
                                            value={notificacoes.intervaloVerificacao}
                                            onChange={(e) =>
                                                setNotificacoes({
                                                    ...notificacoes,
                                                    intervaloVerificacao: Number(e.target.value),
                                                })
                                            }
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={15}>15 minutos</option>
                                            <option value={30}>30 minutos</option>
                                            <option value={60}>1 hora</option>
                                            <option value={120}>2 horas</option>
                                            <option value={240}>4 horas</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveSLA}
                                    disabled={saving}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                                >
                                    <Save className="h-5 w-5" />
                                    {saving ? 'Salvando...' : 'Salvar Notificações'}
                                </button>
                            </div>
                        )}

                        {/* Tab: Relatórios */}
                        {activeTab === 'relatorios' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                                        Exportar Relatórios
                                    </h3>
                                    <p className="mb-6 text-sm text-gray-600">
                                        Gere relatórios completos de SLA em diferentes formatos.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="flex items-center justify-center gap-3 rounded-lg border-2 border-green-200 bg-green-50 p-6 transition-colors hover:bg-green-100"
                                    >
                                        <Download className="h-6 w-6 text-green-600" />
                                        <div className="text-left">
                                            <div className="font-semibold text-gray-900">
                                                Exportar Excel
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Arquivo .xlsx com dados completos
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => handleExport('pdf')}
                                        className="flex items-center justify-center gap-3 rounded-lg border-2 border-red-200 bg-red-50 p-6 transition-colors hover:bg-red-100"
                                    >
                                        <FileText className="h-6 w-6 text-red-600" />
                                        <div className="text-left">
                                            <div className="font-semibold text-gray-900">
                                                Exportar PDF
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Relatório formatado para impressão
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <h4 className="mb-2 font-medium text-blue-900">
                                        ℹ️ Informações sobre os relatórios
                                    </h4>
                                    <ul className="space-y-1 text-sm text-blue-800">
                                        <li>• Relatórios incluem métricas completas de SLA</li>
                                        <li>• Análise por prioridade e status</li>
                                        <li>• Lista de chamados críticos e vencidos</li>
                                        <li>• Gráficos e indicadores visuais</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SLAConfigPanel;
