// components/chamados/HorasMesTooltip.tsx

'use client';

import type { HorasMes } from '@/app/api/chamados/horas-por-mes/route';
import { formatarHorasRelogio } from '@/formatters/formatar-hora';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

    const triggerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

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

    // Posição calculada via getBoundingClientRect + renderizado num portal em
    // document.body, com position:fixed — escapa tanto do overflow-auto da
    // tabela quanto das regras de empilhamento (z-index) próprias de
    // elementos de tabela (<tr>/<thead>), que impedem o tooltip de aparecer
    // por cima do cabeçalho fixo quando a linha está logo abaixo dele.
    const handleEnter = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Centralizado no gatilho por padrão, mas sem deixar passar da borda
        // da tela — o tooltip pode chegar a 400px de largura (max-w-[400px]),
        // então limitamos a posição considerando metade dessa largura.
        const metadeLargura = 200;
        const margem = 12;
        const centro = rect.left + rect.width / 2;
        const left = Math.min(
            Math.max(centro, metadeLargura + margem),
            window.innerWidth - metadeLargura - margem
        );

        setPos({
            bottom: window.innerHeight - rect.top + 8,
            left,
        });
    };

    const handleLeave = () => setPos(null);

    return (
        <>
            <div
                ref={triggerRef}
                className="cursor-help"
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                {children}
            </div>

            {pos &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        style={{ bottom: pos.bottom, left: pos.left }}
                        className={[
                            'fixed z-[100] -translate-x-1/2',
                            'w-max max-w-[400px] min-w-[220px]',
                            'rounded-lg bg-black text-sm tracking-widest text-white shadow-md shadow-black',
                            'px-4 py-2',
                            'flex flex-col gap-3',
                            'pointer-events-none',
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
                    </div>,
                    document.body
                )}
        </>
    );
}
