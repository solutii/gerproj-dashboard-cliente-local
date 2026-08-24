// components/chamados/HorasMesTooltip.tsx

'use client';

import type { HorasMes } from '@/app/api/chamados/horas-por-mes/route';
import { formatarHorasRelogio } from '@/formatters/formatar-hora';
import { useMemo } from 'react';

// ==================== TIPOS ====================
interface ResumoMesAtual {
    contratadas: number;
    adicional: number;
    total: number;
}

interface HorasMesTooltipProps {
    meses: HorasMes[];
    resumoMesAtual?: ResumoMesAtual | null;
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
export function HorasMesTooltip({ meses, resumoMesAtual, children }: HorasMesTooltipProps) {
    const temHistorico = meses.length > 0;
    const temResumoAtual = !!resumoMesAtual;

    const linhas = useMemo(
        () =>
            meses.map((m) => ({
                label: `${MESES_LABEL[m.mes]}/${String(m.ano).slice(2)}`,
                horas: formatarHorasRelogio(m.horasFaturadas),
                valor: m.horasFaturadas,
            })),
        [meses]
    );

    // Total histórico (todos os meses) — soma independente do mês filtrado na tabela
    const totalHistorico = useMemo(
        () => meses.reduce((acc, m) => acc + m.horasFaturadas, 0),
        [meses]
    );

    // Sem nenhum dado (nem histórico mensal, nem resumo do mês filtrado) — não renderiza tooltip
    if (!temHistorico && !temResumoAtual) {
        return <>{children}</>;
    }

    return (
        <div className="group relative">
            {/* Trigger */}
            <div className="cursor-help">{children}</div>

            {/* Tooltip único — tudo aqui dentro, em seções bem separadas */}
            <div
                className={[
                    'absolute bottom-full left-1/24 z-50 -translate-x-2/2',
                    'w-max max-w-[400px] min-w-[220px]',
                    'rounded-lg bg-black text-sm tracking-widest text-white shadow-md shadow-black',
                    'px-4 py-2',
                    'flex flex-col gap-3',
                    'pointer-events-none opacity-0',
                    'group-hover:pointer-events-auto group-hover:opacity-100',
                    'transition-opacity duration-150',
                ].join(' ')}
            >
                {/* ===== Seção 1: mês filtrado na tabela (contratadas/adicional/total) ===== */}
                {temResumoAtual && (
                    <div className="flex flex-col gap-1">
                        <p className="border-b border-gray-400 font-semibold tracking-widest whitespace-nowrap text-white select-none">
                            Mês filtrado
                        </p>
                        <div className="flex justify-between gap-4">
                            <span className="font-semibold tracking-widest text-white select-none">
                                Executadas
                            </span>
                            <span className="font-semibold tracking-widest text-white select-none">
                                {formatarHorasRelogio(resumoMesAtual.contratadas)}
                            </span>
                        </div>
                        {resumoMesAtual.adicional > 0 && (
                            <div className="flex justify-between gap-4">
                                <span className="font-semibold tracking-widest text-yellow-400 select-none">
                                    Adicional
                                </span>
                                <span className="font-semibold tracking-widest text-yellow-400 select-none">
                                    +{formatarHorasRelogio(resumoMesAtual.adicional)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between gap-4 border-t border-gray-500">
                            <span className="font-semibold tracking-widest text-white select-none">
                                Total
                            </span>
                            <span className="font-semibold tracking-widest text-white select-none">
                                {formatarHorasRelogio(resumoMesAtual.total)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Separador pontilhado entre o mês filtrado e o histórico */}
                {temResumoAtual && temHistorico && (
                    <div className="my-2 border-t border-dashed border-gray-500" />
                )}

                {/* ===== Seção 2: histórico completo (todos os meses) ===== */}
                {temHistorico && (
                    <div className="flex flex-col gap-1">
                        <p className="border-b border-gray-400 font-semibold tracking-widest whitespace-nowrap text-white select-none">
                            Histórico de horas executadas
                        </p>

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

                        {linhas.length > 1 && (
                            <div className="flex justify-between border-t border-gray-500">
                                <span className="font-semibold tracking-widest text-white select-none">
                                    Total
                                </span>
                                <span className="font-semibold tracking-widest text-white select-none">
                                    {formatarHorasRelogio(totalHistorico)}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
