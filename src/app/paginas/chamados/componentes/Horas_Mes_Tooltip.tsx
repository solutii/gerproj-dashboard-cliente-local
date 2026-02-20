// components/chamados/HorasMesTooltip.tsx

'use client';

import type { HorasMes } from '@/app/api/chamados/horas-por-mes/route';
import { formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { useMemo } from 'react';

// ==================== TIPOS ====================
interface HorasMesTooltipProps {
    meses: HorasMes[];
    totalHorasFaturadas: number;
    children: React.ReactNode;
}

// ==================== HELPERS ====================
const MESES_LABEL = [
    '',
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
];

// ==================== COMPONENTE ====================
/**
 * Wrapper com tooltip nativo (CSS only, zero dependências).
 * Exibe horas faturadas por mês ao passar o mouse sobre a célula.
 *
 * Uso:
 * <HorasMesTooltip meses={getHoras(chamado.COD_CHAMADO)} totalHorasFaturadas={chamado.TOTAL_HORAS_OS_FATURADAS}>
 *   <span>{formatarHoras(chamado.TOTAL_HORAS_OS_FATURADAS)}</span>
 * </HorasMesTooltip>
 */
export function HorasMesTooltip({ meses, totalHorasFaturadas, children }: HorasMesTooltipProps) {
    // Não renderiza tooltip se não há dados mensais
    const temDados = meses.length > 0;

    const linhas = useMemo(
        () =>
            meses.map((m) => ({
                label: `${MESES_LABEL[m.mes]}/${String(m.ano).slice(2)}`,
                horas: formatarHorasTotaisSufixo(m.horasFaturadas),
                valor: m.horasFaturadas,
            })),
        [meses]
    );

    if (!temDados) {
        return <>{children}</>;
    }

    return (
        <div className="group relative">
            {/* Trigger */}
            <div className="cursor-pointer rounded border-t bg-stone-50 py-1 shadow-sm shadow-black">
                {children}
            </div>

            {/* Tooltip */}
            <div
                className={[
                    'absolute bottom-full left-1/24 z-50 -translate-x-2/2',
                    'w-max max-w-[260px] min-w-[160px]',
                    'rounded-lg bg-black text-sm tracking-widest text-white shadow-md shadow-black',
                    'px-4 py-2',
                    'flex flex-col gap-2',
                    'pointer-events-none opacity-0',
                    'group-hover:pointer-events-auto group-hover:opacity-100',
                    'transition-opacity duration-150',
                ].join(' ')}
            >
                {/* Cabeçalho */}
                <p className="border-b border-gray-400 font-semibold tracking-widest text-white select-none">
                    Horas faturadas por mês
                </p>

                {/* Linhas */}
                <ul className="space-y-1">
                    {linhas.map((l) => (
                        <li key={l.label} className="flex justify-between gap-4">
                            <span className="font-semibold tracking-widest text-white select-none">
                                {l.label}
                            </span>
                            <span className="font-semibold tracking-widest text-white select-none">
                                {l.horas}
                            </span>
                        </li>
                    ))}
                </ul>

                {/* Rodapé: total */}
                {linhas.length > 1 && (
                    <div className="flex justify-between border-t border-gray-500">
                        <span className="font-semibold tracking-widest text-white select-none">
                            Total
                        </span>
                        <span className="font-semibold tracking-widest text-white select-none">
                            {formatarHorasTotaisSufixo(totalHorasFaturadas)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
