// src/app/paginas/validar/[token]/CabecalhoValidacao.tsx

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { FaBuilding, FaLock } from 'react-icons/fa';
import { FaFileWaveform } from 'react-icons/fa6';

interface CabecalhoValidacaoProps {
    codChamado: number;
    nomeCliente?: string | null;
}

// Mesmo vocabulário visual da tela de login: fundo escuro em degradê, grade
// animada, orb ciano, logo + assinatura da Solutii e as cores da marca
// (ciano / roxo / laranja).
export function CabecalhoValidacao({ codChamado, nomeCliente }: CabecalhoValidacaoProps) {
    const reduzirMovimento = useReducedMotion();

    return (
        <header
            className="relative overflow-hidden shadow-lg shadow-black/40"
            style={{
                background: 'linear-gradient(140deg, #060c18 0%, #0a1228 55%, #07101f 100%)',
            }}
        >
            {/* Grade animada */}
            <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.10]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(99,179,237,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.6) 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                }}
                animate={
                    reduzirMovimento ? undefined : { backgroundPosition: ['0px 0px', '48px 48px'] }
                }
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />

            {/* Orbs */}
            <div
                aria-hidden
                className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -bottom-28 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl"
            />

            {/* Marca d'água */}
            <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-6 hidden -translate-y-1/2 text-[110px] leading-none font-black tracking-tighter text-white/[0.03] select-none lg:block"
            >
                SOLUTII
            </span>

            <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-8 sm:py-5">
                {/* Linha da marca */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/logo-solutii.png"
                            alt="Solutii"
                            width={44}
                            height={44}
                            priority
                            className="rounded-xl shadow-md shadow-black/40"
                        />
                        <div className="leading-tight select-none">
                            <p className="text-sm font-bold tracking-widest text-white uppercase sm:text-base">
                                Solutii Sistemas
                            </p>
                            <p className="text-[11px] font-semibold tracking-wider sm:text-xs">
                                <span className="text-cyan-400">Tecnologia</span>{' '}
                                <span className="text-white">&amp;</span>{' '}
                                <span className="text-orange-400">Consultoria</span>
                            </p>
                        </div>
                    </div>

                    <span className="hidden items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold tracking-widest text-cyan-200 uppercase select-none sm:inline-flex">
                        <FaLock size={10} />
                        Link seguro
                    </span>
                </div>

                {/* Divisor com as cores da marca */}
                <div className="h-px w-full bg-gradient-to-r from-cyan-500/70 via-purple-500/60 to-orange-500/70" />

                {/* Título, número do chamado e cliente */}
                <div className="flex items-center justify-center gap-4">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 shadow-lg shadow-purple-900/40 sm:h-14 sm:w-14">
                        <FaFileWaveform className="text-white" size={26} />
                    </span>

                    <div className="flex min-w-0 flex-col items-center gap-1 text-center text-white select-none">
                        <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-0.5">
                            <h1 className="text-sm font-extrabold tracking-[0.2em] text-cyan-300 uppercase sm:text-base">
                                VALIDAÇÃO DE CHAMADO
                            </h1>
                            <span className="text-xl font-black tracking-wider sm:text-3xl">
                                Nº {String(codChamado).padStart(5, '0')}
                            </span>
                        </div>
                        {nomeCliente && (
                            <p className="flex items-center gap-2 self-start text-left text-sm font-semibold tracking-wide uppercase sm:text-base">
                                <FaBuilding
                                    className="hidden flex-shrink-0 text-cyan-300 sm:block"
                                    size={13}
                                />
                                <span className="min-w-0">{nomeCliente}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Filete inferior nas cores da marca */}
            <div className="h-[3px] w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-orange-500" />
        </header>
    );
}
