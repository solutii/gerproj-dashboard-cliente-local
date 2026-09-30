// src/components/chamados/tabelas/Colunas_Tabela_OS.tsx

import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasRelogio } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { HorasAdicionaisResult } from '@/lib/os/calcular-horas-adicionais';
import { ColumnDef } from '@tanstack/react-table';
import React from 'react';
import { FaCheck } from 'react-icons/fa';
import { MdClose, MdOpenInNew } from 'react-icons/md';

// =====================================================
// MODULE AUGMENTATION
// =====================================================
declare module '@tanstack/react-table' {
    interface TableMeta<TData> {
        handleOpenModalObs?: (os: TData) => void;
        onSelectOS?: (os: TData) => void;
    }
}

// =====================================================
// INTERFACES E TIPOS
// =====================================================
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
    HORAS_ADICIONAL?: HorasAdicionaisResult;
}

// =====================================================
// CONSTANTES
// =====================================================
const EMPTY_VALUE = '---------------';

// Mesma técnica de profundidade dos pills de totais e dos badges de horas:
// degradê com contraste + brilho no topo (inset claro) + friso escuro embaixo
// por dentro (inset escuro) + sombra colada e espalhada na cor do próprio
// status, em vez de uma cor chapada com sombra genérica.
const VALIDATION_STYLES = {
    SIM: {
        container:
            'border-green-700 bg-gradient-to-b from-green-400 to-green-600 text-black shadow-[inset_0_1.5px_0_rgba(255,255,255,0.5),inset_0_-2px_2px_rgba(21,87,36,0.35),0_1px_1px_rgba(21,87,36,0.3),0_6px_14px_-5px_rgba(21,87,36,0.65)]',
        icon: 'text-black',
        label: 'Aprovada',
        Icon: FaCheck,
    },
    NAO: {
        container:
            'border-red-700 bg-gradient-to-b from-red-400 to-red-600 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.5),inset_0_-2px_2px_rgba(127,29,29,0.35),0_1px_1px_rgba(127,29,29,0.3),0_6px_14px_-5px_rgba(127,29,29,0.65)]',
        icon: 'text-white',
        label: 'Reprovada',
        Icon: MdClose,
    },
    DEFAULT: {
        container:
            'border-gray-500 bg-gradient-to-b from-gray-200 to-gray-400 text-gray-900 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.7),inset_0_-2px_2px_rgba(55,65,81,0.25),0_1px_1px_rgba(55,65,81,0.2),0_6px_14px_-5px_rgba(55,65,81,0.45)]',
        icon: '',
        label: null,
        Icon: null,
    },
} as const;

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================
const setupTruncationTooltip = (el: HTMLDivElement | null, text: string) => {
    if (!el) return;
    const isTruncated = el.scrollWidth > el.clientWidth;
    if (isTruncated) {
        el.setAttribute('title', text);
        el.classList.add('cursor-help');
    } else {
        el.removeAttribute('title');
        el.classList.remove('cursor-help');
    }
};

const formatNomeRecurso = (value: string): string => {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
};

const normalizeValidationStatus = (status?: string | null): keyof typeof VALIDATION_STYLES => {
    const statusNormalized = (status ?? '').toString().toUpperCase().trim();
    if (statusNormalized === 'NAO') return 'NAO';
    if (statusNormalized === 'SIM') return 'SIM';
    return 'DEFAULT';
};

// =====================================================
// COMPONENTES AUXILIARES BASE
// =====================================================
interface ValidacaoBadgeProps {
    status?: string | null;
}

const ValidacaoBadge = React.memo(function ValidacaoBadge({ status }: ValidacaoBadgeProps) {
    const statusKey = normalizeValidationStatus(status);
    const config = VALIDATION_STYLES[statusKey];
    const IconComponent = config.Icon;

    return (
        <div
            className={`flex items-center justify-center gap-2 rounded border px-4 py-1.5 text-sm font-extrabold tracking-wide select-none ${config.container}`}
        >
            {IconComponent && <IconComponent className={config.icon} size={18} />}
            {config.label || status || EMPTY_VALUE}
        </div>
    );
});

interface ActionButtonOSProps {
    onClick: (e: React.MouseEvent) => void;
    title: string;
}

const ActionButtonOS = React.memo(function ActionButtonOS({ onClick, title }: ActionButtonOSProps) {
    return (
        <button onClick={onClick} title={title}>
            <MdOpenInNew
                className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 hover:-rotate-45 active:scale-95"
                size={28}
            />
        </button>
    );
});

interface CellHeaderOSProps {
    children: React.ReactNode;
}

const CellHeaderOS = React.memo(function CellHeaderOS({ children }: CellHeaderOSProps) {
    return (
        <div className="text-center text-sm font-extrabold tracking-wide text-white select-none">
            {children}
        </div>
    );
});

interface CellTextOSProps {
    value: string | number;
    className?: string;
}

const CellTextOS = React.memo(function CellTextOS({ value, className = '' }: CellTextOSProps) {
    return (
        <div
            className={`text-center text-sm font-semibold tracking-wide text-black select-none ${className}`}
        >
            {value}
        </div>
    );
});

interface TruncatedCellOSProps {
    value: string;
    className?: string;
}

const TruncatedCellOS = React.memo(function TruncatedCellOS({
    value,
    className = '',
}: TruncatedCellOSProps) {
    return (
        <div
            ref={(el) => setupTruncationTooltip(el, value)}
            className={`flex-1 truncate overflow-hidden text-sm font-semibold tracking-wide whitespace-nowrap text-black select-none ${className}`}
        >
            {value}
        </div>
    );
});

// =====================================================
// COMPONENTE: BREAKDOWN DE HORAS ADICIONAIS
// =====================================================

interface HorasAdicionaisBreakdownProps {
    horas: HorasAdicionaisResult;
}

/**
 * Exibe o breakdown completo de horas:
 *  - Linha de horas dentro do horário comercial (verde)
 *  - Linha de horas fora do horário (laranja) + equivalente com ×1.5
 *  - Linha de total equivalente em destaque
 *
 * Se não houver adicional, exibe apenas o total bruto de forma compacta.
 */
const HorasAdicionaisBreakdown = React.memo(function HorasAdicionaisBreakdown({
    horas,
}: HorasAdicionaisBreakdownProps) {
    return (
        <div className="flex flex-col gap-2.5 p-0.5">
            {/* Mesma técnica de profundidade dos pills de totais da OS: degradê
                com contraste + brilho no topo (inset claro) + friso escuro
                embaixo por dentro (inset escuro) + sombra colada e espalhada
                na própria cor do badge. */}
            {/* Horas sem adicional (comercial + janela 05–08) */}
            {horas.temAdicional && horas.horasSemAdicional > 0 && (
                <div className="flex items-center justify-between gap-2 rounded border border-green-400 bg-gradient-to-b from-green-50 to-green-300 px-2 py-0.5 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(21,128,61,0.25),0_1px_1px_rgba(21,128,61,0.25),0_6px_14px_-5px_rgba(21,128,61,0.55)]">
                    <span className="text-sm font-extrabold tracking-wide text-green-900 select-none">
                        HR Comercial
                    </span>
                    <span className="text-sm font-extrabold tracking-wide text-green-900 select-none">
                        {formatarHorasRelogio(horas.horasSemAdicional)}
                    </span>
                </div>
            )}

            {/* Horas com adicional: bruto → equivalente */}
            {horas.temAdicional && horas.horasAdicionalGerado > 0 && (
                <div className="flex items-center justify-between gap-2 rounded border border-orange-400 bg-gradient-to-b from-orange-50 to-orange-300 px-2 py-0.5 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(194,65,12,0.25),0_1px_1px_rgba(194,65,12,0.25),0_6px_14px_-5px_rgba(194,65,12,0.55)]">
                    <span className="text-sm font-extrabold tracking-wide text-orange-900 select-none">
                        HR Não Comercial
                    </span>
                    <span className="text-sm font-extrabold tracking-wide text-orange-900 select-none">
                        {formatarHorasRelogio(horas.horasComAdicional)}
                    </span>
                </div>
            )}

            {/* Adicional gerado */}
            {horas.temAdicional && horas.horasAdicionalGerado > 0 && (
                <div className="flex items-center justify-between gap-2 rounded border border-yellow-400 bg-gradient-to-b from-yellow-50 to-yellow-300 px-2 py-0.5 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(161,98,7,0.25),0_1px_1px_rgba(161,98,7,0.25),0_6px_14px_-5px_rgba(161,98,7,0.55)]">
                    <span className="text-sm font-extrabold tracking-wide text-yellow-900 select-none">
                        HR Adicional
                    </span>
                    <span className="text-sm font-extrabold tracking-wide text-yellow-900 select-none">
                        +{formatarHorasRelogio(horas.horasAdicionalGerado)}
                    </span>
                </div>
            )}

            {/* Total equivalente — sempre visível */}
            <div className="flex items-center justify-between gap-2 rounded border border-purple-400 bg-gradient-to-b from-purple-50 to-purple-300 px-2 py-0.5 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(126,34,206,0.25),0_1px_1px_rgba(126,34,206,0.25),0_6px_14px_-5px_rgba(126,34,206,0.55)]">
                <span className="text-sm font-extrabold tracking-wide text-purple-900 select-none">
                    Total HR
                </span>
                <span className="text-sm font-extrabold tracking-wide text-purple-900 select-none">
                    {formatarHorasRelogio(horas.totalHorasEquivalente)}
                </span>
            </div>
        </div>
    );
});

// =====================================================
// DEFINIÇÃO DAS COLUNAS
// =====================================================
export const getColunasOS = (): ColumnDef<OSRowProps>[] => {
    return [
        // ==================== NÚMERO OS ====================
        {
            accessorKey: 'NUM_OS',
            id: 'NUM_OS',
            header: () => <CellHeaderOS>NÚM. OS</CellHeaderOS>,
            cell: ({ getValue, row, table }) => {
                const value = (getValue() as number) ?? EMPTY_VALUE;
                const onSelectOS = table.options.meta?.onSelectOS;

                return (
                    <div className="flex items-center gap-2">
                        <ActionButtonOS
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectOS?.(row.original);
                            }}
                            title="Validação OS"
                        />
                        <div className="flex-1">
                            <CellTextOS value={formatarNumeros(value)} />
                        </div>
                    </div>
                );
            },
        },

        // ==================== DATA INÍCIO ====================
        {
            accessorKey: 'DTINI_OS',
            id: 'DTINI_OS',
            header: () => <CellHeaderOS>DATA</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return <CellTextOS value={formatarDataParaBR(value)} />;
            },
        },

        // ==================== HORA INÍCIO ====================
        {
            accessorKey: 'HRINI_OS',
            id: 'HRINI_OS',
            header: () => <CellHeaderOS>HR. INÍCIO</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return <CellTextOS value={formatarHora(value)} />;
            },
        },

        // ==================== HORA FIM ====================
        {
            accessorKey: 'HRFIM_OS',
            id: 'HRFIM_OS',
            header: () => <CellHeaderOS>HR. FIM</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return <CellTextOS value={formatarHora(value)} />;
            },
        },

        // ==================== HORAS COM ADICIONAL (breakdown) ====================
        {
            accessorKey: 'HORAS_ADICIONAL',
            id: 'HORAS_ADICIONAL',
            enableSorting: false,
            header: () => <CellHeaderOS>DESCRIÇÃO HORAS</CellHeaderOS>,
            cell: ({ getValue }) => {
                const horas = getValue() as HorasAdicionaisResult | undefined;

                if (!horas) {
                    return <CellTextOS value={EMPTY_VALUE} />;
                }

                return <HorasAdicionaisBreakdown horas={horas} />;
            },
        },

        // ==================== OBSERVAÇÃO ====================
        {
            accessorKey: 'OBS',
            id: 'OBS',
            enableSorting: false,
            header: () => <CellHeaderOS>OBSERVAÇÃO</CellHeaderOS>,
            cell: ({ getValue, row, table }) => {
                const value = getValue() as string | null;
                const hasObservacao = value && value !== EMPTY_VALUE;
                const handleOpenModalObs = table.options.meta?.handleOpenModalObs;

                return (
                    <div className="flex w-full items-center gap-4">
                        {hasObservacao && handleOpenModalObs && (
                            <ActionButtonOS
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenModalObs(row.original);
                                }}
                                title="Visualizar observação completa"
                            />
                        )}
                        <TruncatedCellOS value={value ?? ''} />
                    </div>
                );
            },
        },

        // ==================== CONSULTOR ====================
        {
            accessorKey: 'NOME_RECURSO',
            id: 'NOME_RECURSO',
            header: () => <CellHeaderOS>CONSULTOR</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                if (value === EMPTY_VALUE) return <CellTextOS value={value} />;
                return <TruncatedCellOS value={formatNomeRecurso(value)} />;
            },
        },

        // ==================== ENTREGÁVEL ====================
        {
            accessorKey: 'NOME_TAREFA',
            id: 'NOME_TAREFA',
            header: () => <CellHeaderOS>ENTREGÁVEL</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                if (value === EMPTY_VALUE) return <CellTextOS value={value} />;
                return <TruncatedCellOS value={value} />;
            },
        },

        // ==================== VALIDAÇÃO ====================
        {
            accessorKey: 'VALCLI_OS',
            id: 'VALCLI_OS',
            header: () => <CellHeaderOS>VALIDAÇÃO</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                return (
                    <div className="flex w-full justify-center">
                        <ValidacaoBadge status={value} />
                    </div>
                );
            },
        },
    ];
};
