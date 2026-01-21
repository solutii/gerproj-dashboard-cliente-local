import { ColumnDef } from '@tanstack/react-table';
import { FaTimesCircle } from 'react-icons/fa';
import { MdCheck, MdCheckCircle, MdInsertDriveFile } from 'react-icons/md';
import { formatarDataParaBR } from '../../formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '../../formatters/formatar-hora';
import { formatarNumeros } from '../../formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';

declare module '@tanstack/react-table' {
    interface TableMeta<TData> {
        handleOpenModalObs?: (os: TData) => void;
        onSelectOS?: (os: TData) => void;
    }
}

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

// ==================== COMPONENTE DE VALIDAÇÃO ====================
const ValidacaoBadge = ({ status }: { status?: string | null }) => {
    const statusNormalized = (status ?? 'SIM').toString().toUpperCase().trim();

    if (statusNormalized === 'SIM') {
        return (
            <div className="inline-flex items-center gap-2 rounded-md border-t border-green-600 bg-green-600 px-6 py-1.5 text-sm font-extrabold tracking-widest text-white shadow-md shadow-black select-none">
                <MdCheckCircle className="text-white" size={16} />
                Aprovada
            </div>
        );
    }

    if (statusNormalized === 'NAO') {
        return (
            <div className="inline-flex items-center gap-2 rounded border border-red-800 bg-red-600 px-3 py-1.5 text-sm font-extrabold tracking-widest text-white select-none">
                <FaTimesCircle className="text-white" size={16} />
                Recusada
            </div>
        );
    }

    return (
        <div className="inline-flex items-center gap-2 rounded border border-gray-400 bg-gray-300 px-3 py-1.5 text-sm font-extrabold tracking-widest text-black italic select-none">
            {status ?? '---------------'}
        </div>
    );
};

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export const getColunasOS = (): ColumnDef<OSRowProps>[] => {
    return [
        // Número da OS
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
                            className="flex-shrink-0 cursor-pointer rounded-full bg-purple-600 p-2 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:bg-purple-500 hover:shadow-xl hover:shadow-black active:scale-95"
                            title="Aprovação da OS"
                        >
                            <MdCheck className="text-white" size={18} />
                        </button>

                        {/* Número da OS */}
                        <div className="flex-1 text-center text-sm font-semibold tracking-widest text-black select-none">
                            {formatarNumeros(value)}
                        </div>
                    </div>
                );
            },
        },

        // Data de Início da OS
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

        // Hora de Início da OS
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

        // Hora Fim da OS
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

        // Total de Horas da OS
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

        // OBSERVAÇÃO
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
                                className="flex-shrink-0 cursor-pointer rounded-full bg-purple-600 p-2 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:bg-purple-500 hover:shadow-xl hover:shadow-black active:scale-95"
                                title="Visualizar observação completa"
                            >
                                <MdInsertDriveFile className="text-white" size={18} />
                            </button>
                        )}

                        {/* Texto da observação - com tooltip nativo */}
                        <div
                            className="flex-1 cursor-help truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                            title={correctedTextValue}
                        >
                            {correctedTextValue}
                        </div>
                    </div>
                );
            },
        },

        // Consultor da OS
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
                        className="flex-1 cursor-help truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                        title={correctedTextValue}
                    >
                        {display}
                    </div>
                );
            },
        },

        // Nome da Tarefa
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
                        className="flex-1 cursor-help truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none"
                        title={correctedTextValue}
                    >
                        {correctedTextValue}
                    </div>
                );
            },
        },

        // Validação da OS
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
    ];
};
