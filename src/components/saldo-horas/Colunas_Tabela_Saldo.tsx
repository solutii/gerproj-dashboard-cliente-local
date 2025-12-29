import { formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { ColumnDef } from '@tanstack/react-table';
import {
    FaCheckCircle,
    FaExchangeAlt,
    FaExclamationTriangle,
    FaMinusCircle,
    FaTimesCircle,
} from 'react-icons/fa';

export interface Compensacao {
    mesOrigem: string;
    horasCompensadas: number;
    tipoCompensacao: 'credito_utilizado' | 'debito_compensado';
}

export interface SaldoRowProps {
    mes: number;
    ano: number;
    horasContratadas: number;
    horasExecutadas: number;
    saldoBruto: number;
    saldoLiquido: number;
    compensacoes: Compensacao[];
    validoAte: string;
    status: 'disponivel' | 'expirado' | 'zerado' | 'negativo' | 'compensado';
    mesesDesdeApuracao: number;
    expirado: boolean;
}

const StatusBadge = ({
    status,
}: {
    status: 'disponivel' | 'expirado' | 'zerado' | 'negativo' | 'compensado';
}) => {
    if (status === 'disponivel') {
        return (
            <div className="inline-flex items-center gap-3 rounded border border-green-400 bg-emerald-100 px-3 py-1.5 text-xs font-extrabold tracking-widest text-green-700 select-none sm:text-sm">
                <FaCheckCircle size={18} />
                <span>Disponível</span>
            </div>
        );
    }

    if (status === 'compensado') {
        return (
            <div className="inline-flex items-center gap-3 rounded border border-blue-400 bg-blue-100 px-3 py-1.5 text-xs font-extrabold tracking-widest text-blue-700 select-none sm:text-sm">
                <FaExchangeAlt size={18} />
                <span>Compensado</span>
            </div>
        );
    }

    if (status === 'negativo') {
        return (
            <div className="inline-flex items-center gap-3 rounded border border-yellow-400 bg-yellow-100 px-3 py-1.5 text-xs font-extrabold tracking-widest text-yellow-700 select-none sm:text-sm">
                <FaMinusCircle size={18} />
                <span>Débito</span>
            </div>
        );
    }

    if (status === 'expirado') {
        return (
            <div className="tracking-widwidester inline-flex items-center gap-3 rounded border border-red-400 bg-red-100 px-3 py-1.5 text-xs font-extrabold text-red-700 select-none sm:text-sm">
                <FaTimesCircle size={18} />
                <span>Expirado</span>
            </div>
        );
    }

    return (
        <div className="inline-flex items-center gap-3 rounded border border-gray-400 bg-gray-100 px-3 py-1.5 text-xs font-extrabold tracking-widest text-gray-700 select-none sm:text-sm">
            <FaExclamationTriangle size={18} />
            <span>Zerado</span>
        </div>
    );
};

const CompensacoesTooltip = ({ compensacoes }: { compensacoes: Compensacao[] }) => {
    if (!compensacoes || compensacoes.length === 0) return null;

    return (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
            {compensacoes.map((comp, idx) => (
                <div
                    key={idx}
                    className={`rounded px-2 py-1 text-sm font-semibold tracking-widest ${
                        comp.tipoCompensacao === 'credito_utilizado'
                            ? 'border border-yellow-400 bg-yellow-100 text-yellow-700'
                            : 'border border-green-400 bg-green-100 text-green-700'
                    }`}
                >
                    <FaExchangeAlt className="mr-1 inline" size={10} />
                    {comp.tipoCompensacao === 'credito_utilizado'
                        ? `Usado em ${comp.mesOrigem}: -${comp.horasCompensadas.toFixed(1)}h`
                        : `Compensado com ${comp.mesOrigem}: +${comp.horasCompensadas.toFixed(1)}h`}
                </div>
            ))}
        </div>
    );
};

export const getColunasSaldo = (): ColumnDef<SaldoRowProps>[] => {
    return [
        {
            accessorKey: 'periodo',
            id: 'periodo',
            header: () => (
                <div className="text-center text-xs font-extrabold tracking-widest text-white select-none sm:text-sm">
                    PERÍODO
                </div>
            ),
            cell: ({ row }) => {
                const { mes, ano } = row.original;
                return (
                    <div className="text-center text-xs font-bold tracking-widest text-black select-none sm:text-sm">
                        {mes.toString().padStart(2, '0')}/{ano}
                    </div>
                );
            },
        },

        {
            accessorKey: 'horasContratadas',
            id: 'horasContratadas',
            header: () => (
                <div className="text-center text-xs font-extrabold tracking-widest text-white select-none sm:text-sm">
                    CONTRATADAS
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as number;
                return (
                    <div className="text-center text-xs font-semibold tracking-widest text-black select-none sm:text-sm">
                        {formatarHorasTotaisSufixo(value)}
                    </div>
                );
            },
        },

        {
            accessorKey: 'horasExecutadas',
            id: 'horasExecutadas',
            header: () => (
                <div className="text-center text-xs font-extrabold tracking-widest text-white select-none sm:text-sm">
                    EXECUTADAS
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as number;
                return (
                    <div className="text-center text-xs font-semibold tracking-widest text-black select-none sm:text-sm">
                        {formatarHorasTotaisSufixo(value)}
                    </div>
                );
            },
        },

        {
            accessorKey: 'saldoBruto',
            id: 'saldoBruto',
            header: () => (
                <div className="text-center text-xs font-extrabold tracking-widest text-white select-none sm:text-sm">
                    SALDO BRUTO
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as number;
                const color =
                    value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-black';

                const valorFormatado = formatarHorasTotaisSufixo(Math.abs(value));

                return (
                    <div
                        className={`text-center text-xs font-bold tracking-widest select-none sm:text-sm ${color}`}
                    >
                        {value < 0 && '-'}
                        {value > 0 && '+'}
                        {valorFormatado}
                    </div>
                );
            },
        },

        {
            accessorKey: 'saldoLiquido',
            id: 'saldoLiquido',
            header: () => (
                <div className="text-center text-xs font-extrabold tracking-widest text-white select-none sm:text-sm">
                    SALDO LÍQUIDO
                </div>
            ),
            cell: ({ getValue, row }) => {
                const value = getValue() as number;
                const { compensacoes } = row.original;
                const color =
                    value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-black';

                const valorFormatado = formatarHorasTotaisSufixo(Math.abs(value));

                return (
                    <div className="text-center">
                        <div
                            className={`text-xs font-bold tracking-widest select-none sm:text-sm ${color}`}
                        >
                            {value < 0 && '-'}
                            {value > 0 && '+'}
                            {valorFormatado}
                        </div>
                        <CompensacoesTooltip compensacoes={compensacoes} />
                    </div>
                );
            },
        },

        {
            accessorKey: 'validoAte',
            id: 'validoAte',
            header: () => (
                <div className="text-center text-xs font-extrabold tracking-widest text-white select-none sm:text-sm">
                    VÁLIDO ATÉ
                </div>
            ),
            cell: ({ getValue, row }) => {
                const value = getValue() as string;
                const { status } = row.original;

                if (status === 'expirado') {
                    return (
                        <div className="text-center text-xs font-semibold tracking-widest text-red-600 select-none sm:text-sm">
                            Expirado
                        </div>
                    );
                }

                if (status === 'zerado' || status === 'compensado') {
                    return (
                        <div className="text-center text-xs font-semibold tracking-widest text-black select-none sm:text-sm">
                            -
                        </div>
                    );
                }

                if (status === 'negativo') {
                    return (
                        <div className="text-center text-xs font-bold tracking-widest text-red-600 select-none sm:text-sm">
                            -
                        </div>
                    );
                }

                return (
                    <div className="text-center text-xs font-semibold tracking-widest text-green-600 select-none sm:text-sm">
                        {value}
                    </div>
                );
            },
        },

        {
            accessorKey: 'status',
            id: 'status',
            header: () => (
                <div className="text-center text-xs font-extrabold tracking-widest text-white select-none sm:text-sm">
                    STATUS
                </div>
            ),
            cell: ({ getValue }) => {
                const value = getValue() as
                    | 'disponivel'
                    | 'expirado'
                    | 'zerado'
                    | 'negativo'
                    | 'compensado';
                return (
                    <div className="flex w-full justify-center">
                        <StatusBadge status={value} />
                    </div>
                );
            },
        },
    ];
};
