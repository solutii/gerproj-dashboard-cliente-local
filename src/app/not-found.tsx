// src/app/not-found.tsx
//
// Página exibida pelo Next.js para qualquer URL sem rota (e para notFound()).
// Segue o visual da tela de login: fundo escuro com grade animada, orb
// central, texto decorativo ao fundo e a paleta ciano/roxo/laranja da Solutii.

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IoArrowBack, IoCompassOutline, IoHome } from 'react-icons/io5';

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' as const, delay },
});

export default function NotFound() {
    const router = useRouter();

    return (
        <main
            className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10"
            style={{
                background: 'linear-gradient(140deg, #060c18 0%, #0a1228 50%, #07101f 100%)',
            }}
        >
            {/* Grade animada */}
            <motion.div
                className="pointer-events-none absolute inset-0 bg-purple-900 opacity-[0.09]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(99,179,237,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.6) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
                animate={{ backgroundPosition: ['0px 0px', '60px 60px'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />

            {/* Orb central */}
            <motion.div
                className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/10 blur-3xl"
                animate={{ scale: [1, 1.08, 0.94, 1], opacity: [0.6, 1, 0.6, 0.6] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            />

            {/* Texto de fundo decorativo */}
            <motion.div
                className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, delay: 0.5 }}
            >
                <span className="text-[140px] font-black tracking-tighter text-white/[0.025] sm:text-[220px] lg:text-[320px]">
                    404
                </span>
            </motion.div>

            {/* Conteúdo */}
            <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-8 text-center">
                <motion.div {...fadeUp(0.1)} className="flex items-center gap-4">
                    <Image
                        src="/logo-solutii.png"
                        alt="Solutii"
                        width={50}
                        height={50}
                        className="rounded-xl"
                        priority
                    />
                    <div className="text-left">
                        <p className="font-bold tracking-widest text-white uppercase select-none">
                            Solutii Sistemas
                        </p>
                        <p className="inline-flex gap-1 text-sm font-semibold tracking-wider text-white select-none">
                            <span className="text-cyan-500">Tecnologia</span> &amp;{' '}
                            <span className="text-orange-500">Consultoria</span>
                        </p>
                    </div>
                </motion.div>

                <motion.div {...fadeUp(0.2)} className="flex flex-col items-center gap-3">
                    <div className="flex items-center justify-center gap-3 sm:gap-5">
                        <span className="bg-gradient-to-br from-cyan-300 via-cyan-500 to-purple-500 bg-clip-text text-8xl leading-none font-black tracking-tight text-transparent select-none sm:text-9xl">
                            4
                        </span>
                        <motion.span
                            className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.25)] sm:h-28 sm:w-28"
                            animate={{ rotate: [0, 12, -12, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <IoCompassOutline className="text-cyan-300" size={56} />
                        </motion.span>
                        <span className="bg-gradient-to-br from-purple-500 via-cyan-500 to-cyan-300 bg-clip-text text-8xl leading-none font-black tracking-tight text-transparent select-none sm:text-9xl">
                            4
                        </span>
                    </div>

                    <h1 className="text-2xl font-extrabold tracking-widest text-white uppercase select-none sm:text-3xl">
                        Página não encontrada
                    </h1>
                    <p className="max-w-md text-sm font-semibold tracking-wider text-white/60 select-none sm:text-base">
                        O endereço que você tentou acessar não existe ou foi movido. Verifique o
                        link ou volte para o início.
                    </p>
                </motion.div>

                <motion.div
                    {...fadeUp(0.35)}
                    className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row"
                >
                    <Link
                        href="/"
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-cyan-600 to-teal-700 px-6 py-3 text-sm font-extrabold tracking-widest text-white uppercase shadow-md shadow-black/40 transition-all duration-200 select-none hover:-translate-y-0.5 hover:from-cyan-500 hover:to-teal-600 hover:shadow-lg hover:shadow-black/50 active:scale-95"
                    >
                        <IoHome size={18} />
                        Ir para o início
                    </Link>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-extrabold tracking-widest text-white uppercase backdrop-blur-sm transition-all duration-200 select-none hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/10 active:scale-95"
                    >
                        <IoArrowBack size={18} />
                        Voltar
                    </button>
                </motion.div>
            </div>
        </main>
    );
}
