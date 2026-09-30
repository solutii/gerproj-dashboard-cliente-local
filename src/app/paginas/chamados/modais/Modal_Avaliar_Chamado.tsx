// src/components/chamados/modais/Modal_Avaliar_Chamado.tsx

'use client';

import { ZOOM_PAGINAS } from '@/components/loading-titles';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { alertError, alertSuccess, alertWarning } from '@/store/useAlertDialogStore';
import { gsap } from 'gsap';
import { Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';
import { MdMiscellaneousServices, MdSend } from 'react-icons/md';

interface ModalAvaliacaoChamadoProps {
    isOpen: boolean;
    onClose: () => void;
    codChamado: number;
    assuntoChamado: string | null;
    solicitacaoChamado: string | null;
    observacaoChamado?: string | null;
    onSave: () => void;
    // Token do link de e-mail (/paginas/validar/[token]) — só é passado
    // nesse fluxo público sem login; dentro do app logado, a rota resolve
    // o cliente pela própria sessão.
    token?: string;
}

// Função para capitalizar a primeira letra
const capitalizarPrimeiraLetra = (texto: string): string => {
    if (!texto) return texto;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Duração das animações de abrir/fechar via GSAP, em segundos.
const MODAL_ANIMATION_SECONDS = 0.2;

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function ModalAvaliarChamado({
    isOpen,
    onClose,
    codChamado,
    assuntoChamado,
    solicitacaoChamado,
    observacaoChamado,
    onSave,
    token,
}: ModalAvaliacaoChamadoProps) {
    // A página de Chamados aplica CSS zoom no <main>; sem portal, esse modal
    // (fixed inset-0) herdaria o zoom e ficaria menor que a tela de verdade.
    // O portal escapa pro <body>, e reaplicamos o mesmo zoom manualmente,
    // igual ao Modal_Validar_OS.
    const isDesktop = useIsDesktop();
    const [nota, setNota] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [observacao, setObservacao] = useState(observacaoChamado || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mantém o modal montado durante a animação de fechamento — sem isso,
    // `isOpen` vira false e o componente some instantaneamente, sem tocar
    // a animação do GSAP.
    const [shouldRender, setShouldRender] = useState(isOpen);
    const overlayRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
        }
    }, [isOpen]);

    // Dispara a animação de abrir/fechar via GSAP sempre que `isOpen` muda
    // (e o modal já está montado) — fechar só desmonta de verdade
    // (`setShouldRender(false)`) quando a animação termina.
    useEffect(() => {
        if (!shouldRender || !overlayRef.current || !contentRef.current) return;

        if (isOpen) {
            gsap.fromTo(
                overlayRef.current,
                { opacity: 0 },
                { opacity: 1, duration: MODAL_ANIMATION_SECONDS, ease: 'power2.out' }
            );
            gsap.fromTo(
                contentRef.current,
                { opacity: 0, y: 24 },
                {
                    opacity: 1,
                    y: 0,
                    duration: MODAL_ANIMATION_SECONDS,
                    ease: 'power2.out',
                }
            );
        } else {
            gsap.to(overlayRef.current, {
                opacity: 0,
                duration: MODAL_ANIMATION_SECONDS,
                ease: 'power2.in',
            });
            gsap.to(contentRef.current, {
                opacity: 0,
                y: 24,
                duration: MODAL_ANIMATION_SECONDS,
                ease: 'power2.in',
                onComplete: () => setShouldRender(false),
            });
        }
    }, [isOpen, shouldRender]);

    // Reseta todo o estado do formulário toda vez que o modal abre pra um
    // chamado — evita que nota/comentário de uma avaliação anterior (com o
    // modal reaberto sem fechar antes, ex.: clicando "Avaliar" em outra
    // linha) vazem pro chamado atual.
    useEffect(() => {
        if (!isOpen) return;

        setNota(0);
        setHoveredStar(0);
        setObservacao(observacaoChamado ? capitalizarPrimeiraLetra(observacaoChamado) : '');
    }, [isOpen, codChamado, observacaoChamado]);

    const handleSubmit = async () => {
        if (nota === 0) {
            alertWarning('Selecione uma nota de 1 a 5 estrelas antes de enviar a avaliação.');
            return;
        }

        setIsSubmitting(true);

        try {
            const observacaoTratada = observacao.trim() ? observacao.trim() : null;

            const response = await fetch(`/api/chamados/${codChamado}/avaliacao`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    avaliacao: nota,
                    observacao: observacaoTratada,
                    token,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error ??
                        `Não foi possível salvar a avaliação do chamado #${codChamado}.`
                );
            }

            onSave();
            await alertSuccess(`Avaliação do chamado #${codChamado} enviada com sucesso!`);
            handleClose();
        } catch (err) {
            console.error('Erro ao salvar avaliação:', err);
            alertError(
                err instanceof Error
                    ? err.message
                    : `Não foi possível salvar a avaliação do chamado #${codChamado}.`
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (isSubmitting) return;

        setNota(0);
        setHoveredStar(0);
        setObservacao('');
        onClose();
    };

    // Handler para capitalizar a primeira letra ao digitar
    const handleObservacaoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const texto = e.target.value;
        setObservacao(capitalizarPrimeiraLetra(texto));
    };

    const getNotaTexto = (n: number) => {
        switch (n) {
            case 1:
                return 'Muito Insatisfeito';
            case 2:
                return 'Insatisfeito';
            case 3:
                return 'Regular';
            case 4:
                return 'Satisfeito';
            case 5:
                return 'Muito Satisfeito';
            default:
                return 'Selecione uma nota';
        }
    };

    if (!shouldRender || typeof document === 'undefined') return null;

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return createPortal(
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-2"
            style={{ zoom: isDesktop ? ZOOM_PAGINAS : 1 }}
        >
            {/* Overlay */}
            <div ref={overlayRef} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal Content */}
            <div
                ref={contentRef}
                style={{ maxHeight: isDesktop ? `${95 / ZOOM_PAGINAS}vh` : '95vh' }}
                className="relative z-10 flex w-7xl flex-col overflow-hidden rounded-xl bg-white"
            >
                {/* ========== HEADER ========== */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-6">
                        <MdMiscellaneousServices
                            className="flex-shrink-0 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                            size={60}
                        />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-3xl font-extrabold">AVALIAR ATENDIMENTO</h1>
                            <p className="text-lg font-semibold">
                                {`Chamado #${codChamado}`} — Sua opinião é muito importante para
                                nós!
                            </p>
                        </div>
                    </div>

                    {/* Botão Fechar */}
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="mr-2 flex-shrink-0 cursor-pointer rounded-md border border-red-800 bg-gradient-to-br from-red-600 to-red-700 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.35),inset_0_-2px_3px_rgba(0,0,0,0.35),0_1px_1px_rgba(0,0,0,0.3),0_8px_20px_-5px_rgba(153,27,27,0.7)] transition-all duration-200 hover:scale-110 hover:from-red-500 hover:to-red-600 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:scale-100 disabled:hover:from-red-600 disabled:hover:to-red-700"
                        aria-label="Fechar modal"
                    >
                        <IoClose
                            className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                            size={36}
                        />
                    </button>
                </header>
                {/* ========== */}

                {/* ========== CONTEÚDO ========== */}
                <div className="flex min-h-0 flex-1 flex-col gap-20 overflow-y-auto bg-stone-200 px-6 py-10">
                    {/* ===== CARDS INFORMAÇÕES ===== */}
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-base font-bold tracking-widest text-black select-none">
                                    Assunto
                                </span>
                            </div>
                            <div className="flex max-h-[223px] flex-col overflow-y-auto rounded-md border border-gray-200 bg-white p-6 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),inset_0_-2px_3px_rgba(0,0,0,0.06),0_1px_1px_rgba(0,0,0,0.08),0_10px_24px_-8px_rgba(0,0,0,0.35)]">
                                <p className="text-justify text-sm font-semibold tracking-widest text-black select-none">
                                    {assuntoChamado || 'Sem assunto'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-base font-bold tracking-widest text-black select-none">
                                    Solicitação
                                </span>
                            </div>
                            <div className="flex max-h-[223px] flex-col overflow-y-auto rounded-md border border-gray-200 bg-white p-6 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),inset_0_-2px_3px_rgba(0,0,0,0.06),0_1px_1px_rgba(0,0,0,0.08),0_10px_24px_-8px_rgba(0,0,0,0.35)]">
                                <p className="text-justify text-sm font-semibold tracking-widest text-black select-none">
                                    {solicitacaoChamado || 'Sem solicitação'}
                                </p>
                            </div>
                        </div>
                    </div>
                    {/* ===== */}

                    {/* ===== AVALIAÇÃO ===== */}
                    <div className="flex flex-col gap-6">
                        {/* === ESTRELAS === */}
                        <div className="flex flex-col gap-3">
                            <h2 className="block text-center text-xl font-extrabold tracking-widest text-black select-none">
                                Como você avalia o atendimento?
                            </h2>
                            <div className="flex justify-center gap-4">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onMouseEnter={() => setHoveredStar(star)}
                                        onMouseLeave={() => setHoveredStar(0)}
                                        onClick={() => setNota(star)}
                                        disabled={isSubmitting}
                                        className="transition-transform hover:scale-125 active:scale-95 disabled:opacity-50"
                                    >
                                        <Star
                                            size={48}
                                            className={
                                                star <= (hoveredStar || nota)
                                                    ? 'fill-yellow-500 text-yellow-500 drop-shadow-[0_2px_3px_rgba(161,98,7,0.6)]'
                                                    : 'text-gray-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
                                            }
                                        />
                                    </button>
                                ))}
                            </div>
                            <div className="text-center">
                                <span
                                    className={`text-base tracking-widest select-none ${
                                        nota > 0
                                            ? 'font-extrabold text-purple-900'
                                            : 'font-semibold text-gray-500'
                                    }`}
                                >
                                    {getNotaTexto(hoveredStar || nota)}
                                </span>
                            </div>
                        </div>
                        {/* === */}

                        {/* === OBSERVAÇÃO === */}
                        <div className="flex flex-col">
                            <div className="relative">
                                <textarea
                                    id="observacao-avaliacao"
                                    value={observacao}
                                    onChange={handleObservacaoChange}
                                    placeholder="Deixe um comentário sobre o atendimento..."
                                    disabled={isSubmitting}
                                    rows={4}
                                    maxLength={200}
                                    className="max-h-[223px] w-full cursor-pointer overflow-y-auto rounded-xl border border-gray-200 bg-white px-4 pt-4 text-justify font-medium tracking-widest text-black shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),inset_0_-2px_3px_rgba(0,0,0,0.06),0_1px_1px_rgba(0,0,0,0.08),0_10px_24px_-8px_rgba(0,0,0,0.35)] transition-all duration-200 select-none placeholder:text-sm placeholder:font-bold placeholder:tracking-widest placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />

                                <div className="mt-1 flex justify-end">
                                    <span
                                        className={`text-xs font-bold tracking-widest ${
                                            observacao.length > 170
                                                ? 'text-red-600'
                                                : 'text-slate-500'
                                        }`}
                                    >
                                        {observacao.length}/200
                                    </span>
                                </div>
                            </div>
                        </div>
                        {/* === */}

                        {/* === BOTÃO ENVIAR === */}
                        <div className="flex items-center justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={nota === 0 || isSubmitting}
                                className="flex w-[250px] cursor-pointer items-center justify-center gap-3 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-3 text-lg font-extrabold tracking-widest whitespace-nowrap text-white shadow-md shadow-black transition-all duration-200 select-none hover:-translate-y-1 hover:from-blue-500 hover:to-blue-600 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <MdSend
                                    className={`text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] ${isSubmitting ? 'animate-send' : ''}`}
                                    size={28}
                                />
                                {isSubmitting ? 'Salvando...' : 'Enviar Avaliação'}
                            </button>
                        </div>
                        {/* === */}
                    </div>
                    {/* ========== */}
                </div>
                {/* ========== */}
            </div>

            {/* Estilos da Animação */}
            <style jsx>{`
                @keyframes send {
                    0%,
                    100% {
                        transform: translateX(0) translateY(0);
                    }
                    50% {
                        transform: translateX(8px) translateY(-3px);
                    }
                }

                .animate-send {
                    animation: send 0.8s ease-in-out infinite;
                }
            `}</style>
        </div>,
        document.body
    );
}
