import { ColumnDef } from '@tanstack/react-table';
import { BiSolidLike } from 'react-icons/bi';
import { MdOpenInNew, MdOutlineStar } from 'react-icons/md';
import { formatarDataHoraChamado } from '../../formatters/formatar-data';
import { formatarHorasTotaisSufixo } from '../../formatters/formatar-hora';
import { formatarNumeros, formatarPrioridade } from '../../formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import { SLACell } from './SLACell';

// ==================== TIPOS ====================
export type ChamadoRowProps = {
    COD_CHAMADO: number;
    DATA_CHAMADO: string;
    HORA_CHAMADO: string;
    SOLICITACAO_CHAMADO?: string | null;
    CONCLUSAO_CHAMADO: string | null;
    STATUS_CHAMADO: string;
    DTENVIO_CHAMADO: string | null;
    ASSUNTO_CHAMADO: string | null;
    EMAIL_CHAMADO: string | null;
    PRIOR_CHAMADO: number;
    AVALIA_CHAMADO: number | null;
    OBSAVAL_CHAMADO: string | null;
    NOME_RECURSO: string | null;
    NOME_CLASSIFICACAO: string | null;
    TOTAL_HORAS_OS: number;
    TEM_OS?: boolean;
    DATA_HISTCHAMADO?: string | null;
    HORA_HISTCHAMADO?: string | null;
    COD_RECURSO?: number | null;

    SLA_STATUS?: string;
    SLA_PERCENTUAL?: number;
    SLA_TEMPO_DECORRIDO?: number;
    SLA_TEMPO_RESTANTE?: number;
    SLA_PRAZO_TOTAL?: number;
    SLA_DENTRO_PRAZO?: boolean;
};

// Função para obter as classes de estilo com base no status
const getStylesStatus = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
        case 'NAO FINALIZADO':
            return 'bg-red-500 border border-red-600 text-black shadow-sm shadow-black';
        case 'EM ATENDIMENTO':
            return 'bg-blue-500 border border-blue-600 text-white shadow-sm shadow-black';
        case 'FINALIZADO':
            return 'bg-green-500 border border-green-600 text-black shadow-sm shadow-black';
        case 'NAO INICIADO':
            return 'bg-red-500 border border-red-600 text-black shadow-sm shadow-black';
        case 'STANDBY':
            return 'bg-orange-500 border border-orange-600 text-white shadow-sm shadow-black';
        case 'ATRIBUIDO':
            return 'bg-cyan-500 border border-cyan-600 text-black shadow-sm shadow-black';
        case 'AGUARDANDO VALIDACAO':
            return 'bg-yellow-500 border border-yellow-600 text-black shadow-sm shadow-black';
        default:
            return 'bg-gray-500 border border-gray-600 text-black shadow-sm shadow-black';
    }
};

// Componente de Badge para Status com Avaliação Integrada
const StatusBadge = ({
    status,
    avaliacao,
    obsAvaliacao,
    onAvaliar,
}: {
    status: string;
    avaliacao: number | null;
    obsAvaliacao?: string | null;
    onAvaliar?: () => void;
}) => {
    const styles = getStylesStatus(status);
    const isFinalizado = status.toUpperCase() === 'FINALIZADO';

    // Se avaliacao for null ou undefined, considera como 1 (não avaliado)
    const avaliacaoValor = avaliacao ?? 1;
    const foiAvaliado = avaliacaoValor >= 2 && avaliacaoValor <= 5;

    return (
        <div className="flex w-full items-center gap-2">
            {/* Badge do Status */}
            <div
                className={`flex items-center justify-center gap-2 rounded px-4 py-1.5 text-sm font-extrabold tracking-widest select-none ${styles} ${isFinalizado ? 'flex-1' : 'w-full'}`}
            >
                {/* Texto do Status */}
                <span className="flex-1">{status}</span>

                {/* Área de Avaliação (só aparece se finalizado) */}
                {isFinalizado && foiAvaliado && (
                    <div className="flex items-center gap-5">
                        {/* Mostrar estrelas da avaliação (AVALIA_CHAMADO > 1) */}
                        <div
                            className="flex gap-0.5"
                            title={`Avaliação: ${avaliacaoValor} estrelas`}
                        >
                            {Array.from({ length: 5 }).map((_, i) => (
                                <MdOutlineStar
                                    key={i}
                                    size={14}
                                    className={
                                        i < avaliacaoValor
                                            ? 'fill-yellow-300 text-yellow-300'
                                            : 'fill-white/50 text-white/50'
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Botão de Avaliar (fora da badge, ao lado) */}
            {isFinalizado && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onAvaliar) {
                            onAvaliar();
                        }
                    }}
                    title={foiAvaliado ? 'Reavaliar chamado' : 'Avaliar chamado'}
                >
                    <BiSolidLike
                        className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 active:scale-95"
                        size={32}
                    />
                </button>
            )}
        </div>
    );
};

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export const getColunasChamados = (
    isAdmin: boolean,
    expandedRows: Set<number>,
    columnWidths?: Record<string, number>,
    onOpenSolicitacao?: (chamado: ChamadoRowProps) => void,
    onOpenAvaliacao?: (chamado: ChamadoRowProps) => void
): ColumnDef<ChamadoRowProps>[] => {
    const allColumns: ColumnDef<ChamadoRowProps>[] = [
        // CÓDIGO DO CHAMADO COM ÍCONE
        {
            accessorKey: 'COD_CHAMADO',
            id: 'COD_CHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    CHAMADO
                </div>
            ),
            cell: ({ getValue, row, table }) => {
                const temOS = row.original.TEM_OS ?? false;
                const value = getValue() as number;
                const handleChamadoClick = table.options.meta?.handleChamadoClick;

                // Se NÃO tem OS, renderiza centralizado
                if (!temOS) {
                    return (
                        <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                            {formatarNumeros(value)}
                        </div>
                    );
                }

                // Se TEM OS, renderiza com botão à esquerda
                return (
                    <div className="flex items-center gap-4">
                        {/* Botão para abrir modal de OS's */}
                        <div className="flex items-center justify-center">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (handleChamadoClick) {
                                        handleChamadoClick(row.original.COD_CHAMADO, temOS);
                                    }
                                }}
                                title="Visualizar OS's do chamado"
                            >
                                <MdOpenInNew
                                    className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 hover:-rotate-45 active:scale-95"
                                    size={32}
                                />
                            </button>
                        </div>

                        {/* Número do Chamado */}
                        <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                            {formatarNumeros(value)}
                        </div>
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // Data/Hora do Chamado
        {
            id: 'DATA_CHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    ENTRADA
                </div>
            ),
            cell: ({ row }) => {
                const data = row.original.DATA_CHAMADO;
                const hora = row.original.HORA_CHAMADO;
                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {data && hora ? formatarDataHoraChamado(data, hora) : '---------------'}
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // Prioridade do Chamado
        {
            accessorKey: 'PRIOR_CHAMADO',
            id: 'PRIOR_CHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    PRIOR.
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as number;
                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {formatarPrioridade(value)}
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // Assunto do Chamado COM BOTÃO
        {
            accessorKey: 'ASSUNTO_CHAMADO',
            id: 'ASSUNTO_CHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    ASSUNTO
                </div>
            ),
            cell: ({ getValue, row }) => {
                const value = getValue() as string | null;
                const correctedTextValue = corrigirTextoCorrompido(value);

                return (
                    <div className="flex w-full items-center gap-4">
                        {onOpenSolicitacao && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenSolicitacao(row.original);
                                }}
                                title="Visualizar assunto e solicitação do chamado"
                            >
                                <MdOpenInNew
                                    className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 hover:-rotate-45 active:scale-95"
                                    size={32}
                                />
                            </button>
                        )}

                        {/* Texto da observação - com tooltip nativo */}
                        <div
                            ref={(el) => {
                                if (el) {
                                    const isTruncated = el.scrollWidth > el.clientWidth;
                                    if (isTruncated) {
                                        el.setAttribute('title', correctedTextValue);
                                        el.classList.add('cursor-help');
                                    } else {
                                        el.removeAttribute('title');
                                        el.classList.remove('cursor-help');
                                    }
                                }
                            }}
                            className="flex-1 truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                        >
                            {correctedTextValue}
                        </div>
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // Email do Chamado
        {
            accessorKey: 'EMAIL_CHAMADO',
            id: 'EMAIL_CHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    EMAIL
                </div>
            ),
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? '---------------';

                const isSemEmailChamado = value === '---------------';

                if (isSemEmailChamado) {
                    return (
                        <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                            {value}
                        </div>
                    );
                }

                return (
                    <div
                        ref={(el) => {
                            if (el) {
                                const isTruncated = el.scrollWidth > el.clientWidth;
                                if (isTruncated) {
                                    el.setAttribute('title', value);
                                    el.classList.add('cursor-help');
                                } else {
                                    el.removeAttribute('title');
                                    el.classList.remove('cursor-help');
                                }
                            }
                        }}
                        className="flex-1 truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                    >
                        {value}
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // Nome Classificação
        {
            accessorKey: 'NOME_CLASSIFICACAO',
            id: 'NOME_CLASSIFICACAO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    CLASSIFICAÇÃO
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as string | null;
                const correctedTextValue = corrigirTextoCorrompido(value);

                return (
                    <div
                        ref={(el) => {
                            if (el) {
                                const isTruncated = el.scrollWidth > el.clientWidth;
                                if (isTruncated) {
                                    el.setAttribute('title', correctedTextValue);
                                    el.classList.add('cursor-help');
                                } else {
                                    el.removeAttribute('title');
                                    el.classList.remove('cursor-help');
                                }
                            }
                        }}
                        className="flex-1 truncate overflow-hidden text-center text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                    >
                        {correctedTextValue}
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // Data de Envio do Chamado
        {
            accessorKey: 'DTENVIO_CHAMADO',
            id: 'DTENVIO_CHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    ATRIBUIÇÃO
                </div>
            ),
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? '---------------';

                const isSemDtEnvioChamado = value === '---------------';

                if (isSemDtEnvioChamado) {
                    return (
                        <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                            {value}
                        </div>
                    );
                }

                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {value}
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // Recurso do Chamado
        {
            accessorKey: 'NOME_RECURSO',
            id: 'NOME_RECURSO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    CONSULTOR
                </div>
            ),
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? '---------------';

                const isSemNomeRecursoChamado = value === '---------------';

                if (isSemNomeRecursoChamado) {
                    return (
                        <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                            {value}
                        </div>
                    );
                }

                const correctedTextValue = corrigirTextoCorrompido(value);
                const parts = correctedTextValue.trim().split(/\s+/).filter(Boolean);
                const display = parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');

                return (
                    <div
                        ref={(el) => {
                            if (el) {
                                const isTruncated = el.scrollWidth > el.clientWidth;
                                if (isTruncated) {
                                    el.setAttribute('title', display);
                                    el.classList.add('cursor-help');
                                } else {
                                    el.removeAttribute('title');
                                    el.classList.remove('cursor-help');
                                }
                            }
                        }}
                        className="flex-1 truncate overflow-hidden text-center text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                    >
                        {display}
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // Status do Chamado
        {
            accessorKey: 'STATUS_CHAMADO',
            id: 'STATUS_CHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    STATUS
                </div>
            ),
            cell: ({ getValue, row }) => {
                const value = getValue() as string;
                const avaliacao = row.original.AVALIA_CHAMADO;

                return (
                    <StatusBadge
                        status={value}
                        avaliacao={avaliacao}
                        onAvaliar={() => {
                            if (onOpenAvaliacao) {
                                onOpenAvaliacao(row.original);
                            }
                        }}
                    />
                );
            },
            enableColumnFilter: true,
            filterFn: (row, _columnId, filterValue) => {
                if (!filterValue) return true;

                const value = row.getValue('STATUS_CHAMADO') as string | null | undefined;
                const cellValueUpper = (value ?? '').toString().toUpperCase().trim();
                const filterValueUpper = filterValue.toString().toUpperCase().trim();

                return cellValueUpper === filterValueUpper;
            },
        },

        // SLA do Chamado
        {
            id: 'SLA_INFO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    SLA
                </div>
            ),
            cell: ({ row }) => {
                const {
                    DATA_CHAMADO,
                    HORA_CHAMADO,
                    PRIOR_CHAMADO,
                    STATUS_CHAMADO,
                    CONCLUSAO_CHAMADO,
                } = row.original;

                return (
                    <SLACell
                        dataChamado={DATA_CHAMADO}
                        horaChamado={HORA_CHAMADO}
                        prioridade={PRIOR_CHAMADO}
                        statusChamado={STATUS_CHAMADO}
                        dataConclusao={CONCLUSAO_CHAMADO}
                    />
                );
            },
            enableColumnFilter: false,
        },

        {
            id: 'DATA_HISTCHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    FINALIZAÇÃO
                </div>
            ),
            cell: ({ row }) => {
                const data = row.original.DATA_HISTCHAMADO;
                const hora = row.original.HORA_HISTCHAMADO;
                const status = row.original.STATUS_CHAMADO;

                // Só exibe se o status for FINALIZADO
                if (status?.toUpperCase() !== 'FINALIZADO' || !data || !hora) {
                    return (
                        <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                            ---------------
                        </div>
                    );
                }

                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {formatarDataHoraChamado(data, hora)}
                    </div>
                );
            },
            enableColumnFilter: true,
        },
        // Quantidade de horas
        {
            accessorKey: 'TOTAL_HORAS_OS',
            id: 'TOTAL_HORAS_OS',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    QTD. HORAS
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as number | null;

                return (
                    <div className="text-center text-base font-extrabold tracking-widest text-black select-none">
                        {formatarHorasTotaisSufixo(value)}
                    </div>
                );
            },
            enableColumnFilter: false,
        },
    ];

    return allColumns;
};
