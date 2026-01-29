import { ColumnDef } from '@tanstack/react-table';
import { FaCheck } from 'react-icons/fa';
import { MdClose, MdOpenInNew } from 'react-icons/md';
import { formatarDataParaBR } from '../../formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '../../formatters/formatar-hora';
import { formatarNumeros } from '../../formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
// ==========
declare module '@tanstack/react-table' {
    interface TableMeta<TData> {
        handleOpenModalObs?: (os: TData) => void;
        onSelectOS?: (os: TData) => void;
    }
}
// ==========

// ==================== INTERFACES ====================
export interface OSRowProps {
    COD_OS: number;
    NUM_OS: number;
    DTINI_OS: string;
    HRINI_OS: string;
    HRFIM_OS: string;
    TOTAL_HORAS_OS: number;
    OBS: string | null;
    NOME_RECURSO: string | null;
    NOME_TAREFA: string | null;
    VALCLI_OS: string | null;
    OBSCLI_OS?: string | null;
    NOME_CLIENTE?: string | null;
}
// ==========

// ==================== COMPONENTE DE VALIDAÇÃO ====================
const ValidacaoBadge = ({ status }: { status?: string | null }) => {
    const statusNormalized = (status ?? 'SIM').toString().toUpperCase().trim();

    if (statusNormalized === 'SIM') {
        return (
            <div className="flex items-center justify-center gap-2 rounded border border-green-600 bg-green-500 px-4 py-1.5 text-sm font-extrabold tracking-widest text-black shadow-sm shadow-black select-none">
                <FaCheck className="text-black" size={18} />
                Aprovada
            </div>
        );
    }

    if (statusNormalized === 'NAO') {
        return (
            <div className="flex items-center justify-center gap-2 rounded border border-red-600 bg-red-500 px-4 py-1.5 text-sm font-extrabold tracking-widest text-white shadow-sm shadow-black select-none">
                <MdClose className="text-white" size={18} />
                Reprovada
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center gap-2 rounded border border-gray-400 bg-gray-300 px-4 py-1.5 text-sm font-extrabold tracking-widest text-black shadow-sm shadow-black select-none">
            {status ?? '---------------'}
        </div>
    );
};
// ==========

// ==================== COMPONENTE PRINCIPAL ====================
export const getColunasOS = (): ColumnDef<OSRowProps>[] => {
    return [
        // NÚMERO OS
        {
            accessorKey: 'NUM_OS',
            id: 'NUM_OS',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    NÚM. OS
                </div>
            ),
            cell: ({ getValue, row, table }) => {
                const value = (getValue() as number) ?? '---------------';

                // Acessa a função onSelectOS do meta
                const onSelectOS = table.options.meta?.onSelectOS;

                return (
                    <div className="flex items-center gap-2">
                        {/* Botão para abrir detalhes da OS */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectOS) {
                                    onSelectOS(row.original);
                                }
                            }}
                            title="Validação OS"
                        >
                            <MdOpenInNew
                                className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 hover:-rotate-45 active:scale-95"
                                size={28}
                            />
                        </button>

                        {/* Número da OS */}
                        <div className="flex-1 text-center text-sm font-semibold tracking-widest text-black select-none">
                            {formatarNumeros(value)}
                        </div>
                    </div>
                );
            },
        },
        // ==========

        // DATA INÍCIO OS
        {
            accessorKey: 'DTINI_OS',
            id: 'DTINI_OS',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    DATA
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {formatarDataParaBR(value)}
                    </div>
                );
            },
        },
        // =========

        // HR. INÍCIO OS
        {
            accessorKey: 'HRINI_OS',
            id: 'HRINI_OS',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    HR. INÍCIO
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {formatarHora(value)}
                    </div>
                );
            },
        },
        // =========

        // HR. FIM OS
        {
            accessorKey: 'HRFIM_OS',
            id: 'HRFIM_OS',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    HR. FIM
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {formatarHora(value)}
                    </div>
                );
            },
        },
        // =========

        // TOTAL HORAS OS
        {
            accessorKey: 'TOTAL_HORAS_OS',
            id: 'TOTAL_HORAS_OS',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    TOTAL HORAS
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as number;
                return (
                    <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                        {formatarHorasTotaisSufixo(value)}
                    </div>
                );
            },
        },
        // =========

        // OBSERVAÇÃO OS
        {
            accessorKey: 'OBS',
            id: 'OBS',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    OBSERVAÇÃO
                </div>
            ),
            cell: ({ getValue, row, table }) => {
                const value = getValue() as string | null;
                const correctedTextValue = corrigirTextoCorrompido(value);
                const hasObservacao = value && value !== '---------------';

                // Pega a função do meta para abrir o modal
                const handleOpenModalObs = table.options.meta?.handleOpenModalObs;

                return (
                    <div className="flex w-full items-center gap-4">
                        {/* Botão para abrir modal */}
                        {hasObservacao && handleOpenModalObs && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenModalObs(row.original);
                                }}
                                title="Visualizar observação completa"
                            >
                                <MdOpenInNew
                                    className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 hover:-rotate-45 active:scale-95"
                                    size={28}
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
        },
        // =========

        // RECURSO OS
        {
            accessorKey: 'NOME_RECURSO',
            id: 'NOME_RECURSO',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    CONSULTOR
                </div>
            ),
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? '---------------';
                const isSemRecurso = value === '---------------';

                if (isSemRecurso) {
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
                        {display}
                    </div>
                );
            },
        },
        // =========

        // NOME TAREFA OS
        {
            accessorKey: 'NOME_TAREFA',
            id: 'NOME_TAREFA',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    ENTREGÁVEL
                </div>
            ),
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? '---------------';
                const isSemNomeTarefa = value === '---------------';

                if (isSemNomeTarefa) {
                    return (
                        <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                            {value}
                        </div>
                    );
                }

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
                        className="flex-1 truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                    >
                        {correctedTextValue}
                    </div>
                );
            },
        },
        // =========

        // VALIDAÇÃO OS
        {
            accessorKey: 'VALCLI_OS',
            id: 'VALCLI_OS',
            header: () => (
                <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
                    VALIDAÇÃO
                </div>
            ),
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? '---------------';
                return (
                    <div className="flex w-full justify-center">
                        <ValidacaoBadge status={value} />
                    </div>
                );
            },
        },
        // =========
    ];
};
