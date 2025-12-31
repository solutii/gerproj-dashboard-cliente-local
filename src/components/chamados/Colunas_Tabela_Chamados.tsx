import { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, FileText, Star, StarOff } from 'lucide-react';
import React from 'react';
import { formatarDataHoraChamado, formatarDataParaBR } from '../../formatters/formatar-data';
import { formatarHorasTotaisSufixo } from '../../formatters/formatar-hora';
import { formatarNumeros, formatarPrioridade } from '../../formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import { TooltipTabela } from '../shared/Tooltip';

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

    NOME_RECURSO: string | null;
    NOME_CLASSIFICACAO: string | null;
    TOTAL_HORAS_OS: number;
    TEM_OS?: boolean;
};

// Função para obter as classes de estilo com base no status
const getStylesStatus = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
        case 'NAO FINALIZADO':
            return 'bg-red-600 border border-red-700 text-white italic';
        case 'EM ATENDIMENTO':
            return 'bg-blue-600 border border-blue-700 text-white italic';
        case 'FINALIZADO':
            return 'bg-green-600 border border-green-700 text-white italic';
        case 'NAO INICIADO':
            return 'bg-yellow-600 border border-yellow-700 text-white italic';
        case 'STANDBY':
            return 'bg-orange-600 border border-orange-700 text-white italic';
        case 'ATRIBUIDO':
            return 'bg-teal-600 border border-teal-700 text-white italic';
        case 'AGUARDANDO VALIDACAO':
            return 'bg-purple-600 border border-purple-700 text-white italic';
        default:
            return 'bg-gray-500 border border-gray-600 text-black italic';
    }
};

// Componente de Badge para Status
// Componente de Badge para Status com Avaliação Integrada
const StatusBadge = ({
    status,
    avaliacao,
    onAvaliar,
}: {
    status: string;
    avaliacao: number | null;
    onAvaliar?: () => void;
}) => {
    const styles = getStylesStatus(status);
    const isFinalizado = status.toUpperCase() === 'FINALIZADO';

    // Se avaliacao for null ou undefined, considera como 1 (não avaliado)
    const avaliacaoValor = avaliacao ?? 1;
    const podeAvaliar = avaliacaoValor === 1;
    const foiAvaliado = avaliacaoValor >= 2 && avaliacaoValor <= 5;

    // DEBUG - Remova depois de testar
    console.log('StatusBadge Debug:', {
        status,
        avaliacao,
        avaliacaoValor,
        podeAvaliar,
        foiAvaliado,
        isFinalizado,
    });

    return (
        <div
            className={`relative flex items-center justify-between gap-2 rounded px-6 py-1.5 text-sm font-extrabold tracking-widest select-none ${styles}`}
        >
            {/* Texto do Status */}
            <span className="flex-1">{status}</span>

            {/* Área de Avaliação (só aparece se finalizado) */}
            {isFinalizado && (
                <div className="flex items-center">
                    {podeAvaliar ? (
                        // Botão para avaliar (AVALIA_CHAMADO = 1)
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onAvaliar) {
                                    onAvaliar();
                                }
                            }}
                            className="flex items-center gap-1 rounded bg-yellow-500 px-2 py-1 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-yellow-600 active:scale-95"
                            title="Avaliar atendimento"
                        >
                            <StarOff size={12} />
                            <span>Avaliar</span>
                        </button>
                    ) : foiAvaliado ? (
                        // Mostrar estrelas da avaliação (AVALIA_CHAMADO > 1)
                        <div
                            className="flex gap-0.5"
                            title={`Avaliação: ${avaliacaoValor} estrelas`}
                        >
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                    key={i}
                                    size={14}
                                    className={
                                        i < avaliacaoValor
                                            ? 'fill-yellow-400 text-yellow-400'
                                            : 'fill-white/30 text-white/30'
                                    }
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

// Componente auxiliar para células com tooltip condicional
const CellWithConditionalTooltip = ({
    content,
    className,
    maxWidth = '400px',
}: {
    content: string;
    className: string;
    maxWidth?: string;
}) => {
    const cellRef = React.useRef<HTMLDivElement>(null);
    const [isTruncated, setIsTruncated] = React.useState(false);

    React.useEffect(() => {
        const checkTruncation = () => {
            if (cellRef.current) {
                setIsTruncated(cellRef.current.scrollWidth > cellRef.current.clientWidth);
            }
        };

        checkTruncation();

        const resizeObserver = new ResizeObserver(checkTruncation);
        if (cellRef.current) {
            resizeObserver.observe(cellRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [content]);

    const cellContent = (
        <div ref={cellRef} className={className}>
            {content}
        </div>
    );

    return isTruncated ? (
        <TooltipTabela content={content} maxWidth={maxWidth}>
            {cellContent}
        </TooltipTabela>
    ) : (
        cellContent
    );
};

// ==================== COLUNAS ====================
export const getColunasChamados = (
    isAdmin: boolean,
    expandedRows: Set<number>,
    columnWidths?: Record<string, number>,
    onOpenSolicitacao?: (chamado: ChamadoRowProps) => void,
    onOpenAvaliacao?: (chamado: ChamadoRowProps) => void // ✅ NOVO parâmetro
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
            cell: ({ getValue, row }) => {
                const temOS = row.original.TEM_OS ?? false;
                const value = getValue() as number;

                return (
                    <div className="flex items-center gap-2">
                        {/* Ícone indicando que há OS's */}
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                            {temOS ? (
                                <ChevronRight
                                    className="text-black transition-transform group-hover:scale-125"
                                    size={24}
                                />
                            ) : (
                                <div className="h-6 w-6" />
                            )}
                        </div>

                        {/* Número do Chamado */}
                        <div className="flex-1 text-left text-sm font-semibold tracking-widest text-black select-none">
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
                        {formatarDataHoraChamado(data, hora)}
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
                const textValue = corrigirTextoCorrompido(value);
                const hasSolicitacao = row.original.SOLICITACAO_CHAMADO;

                return (
                    <div className="flex w-full items-center gap-4">
                        {/* Botão para abrir modal */}
                        {hasSolicitacao && onOpenSolicitacao && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenSolicitacao(row.original);
                                }}
                                className="flex-shrink-0 cursor-pointer rounded-md bg-purple-600 p-2 shadow-md shadow-black transition-all duration-200 hover:scale-110 hover:bg-purple-800 hover:shadow-xl hover:shadow-black active:scale-95"
                                title="Ver solicitação completa"
                            >
                                <FileText className="text-white" size={18} />
                            </button>
                        )}

                        {/* Texto do assunto */}
                        <CellWithConditionalTooltip
                            content={textValue}
                            className="flex-1 truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                            maxWidth="400px"
                        />
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
                    <CellWithConditionalTooltip
                        content={value}
                        className="truncate overflow-hidden text-left text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                        maxWidth="300px"
                    />
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
                const textValue = corrigirTextoCorrompido(value);

                return (
                    <CellWithConditionalTooltip
                        content={textValue}
                        className="truncate overflow-hidden text-left text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                        maxWidth="300px"
                    />
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

                const parts = value.trim().split(/\s+/).filter(Boolean);
                const display = parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
                const textValue = corrigirTextoCorrompido(display);

                return (
                    <CellWithConditionalTooltip
                        content={textValue}
                        className="truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                        maxWidth="250px"
                    />
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

        // Conclusão do chamado
        {
            accessorKey: 'CONCLUSAO_CHAMADO',
            id: 'CONCLUSAO_CHAMADO',
            header: () => (
                <div className="text-center text-sm font-bold tracking-widest text-white select-none">
                    CONCLUSÃO
                </div>
            ),
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? '---------------';

                const isSemConclusaoChamado = value === '---------------';

                if (isSemConclusaoChamado) {
                    return (
                        <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                            {value}
                        </div>
                    );
                }

                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {formatarDataParaBR(value)}
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
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {formatarHorasTotaisSufixo(value)}
                    </div>
                );
            },
            enableColumnFilter: false,
        },
    ];

    return allColumns;
};
