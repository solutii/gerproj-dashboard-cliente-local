// src/app/paginas/base-conhecimento/modais/Modal_Artigo_Base_Conhecimento.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import { FaBook } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Estilo dos elementos markdown — sem plugin de typography do Tailwind,
// aplicando classes direto via overrides de componente do react-markdown.
const MARKDOWN_COMPONENTS: Components = {
    h1: ({ children }) => (
        <h1 className="mt-2 text-2xl font-extrabold tracking-wide text-black">{children}</h1>
    ),
    h2: ({ children }) => (
        <h2 className="mt-4 text-xl font-extrabold tracking-wide text-black">{children}</h2>
    ),
    h3: ({ children }) => (
        <h3 className="mt-3 text-lg font-bold tracking-wide text-black">{children}</h3>
    ),
    p: ({ children }) => (
        <p className="text-sm leading-relaxed tracking-wide text-black">{children}</p>
    ),
    ul: ({ children }) => (
        <ul className="ml-5 list-disc space-y-1 text-sm tracking-wide text-black">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="ml-5 list-decimal space-y-1 text-sm tracking-wide text-black">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-bold text-black">{children}</strong>,
    a: ({ children, href }) => (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-teal-700 underline"
        >
            {children}
        </a>
    ),
    code: ({ children }) => (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-black">
            {children}
        </code>
    ),
    pre: ({ children }) => (
        <pre className="overflow-x-auto rounded bg-gray-100 p-3">{children}</pre>
    ),
    table: ({ children }) => (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-black">{children}</table>
        </div>
    ),
    th: ({ children }) => (
        <th className="border border-gray-300 bg-gray-100 p-2 text-left font-bold">{children}</th>
    ),
    td: ({ children }) => <td className="border border-gray-300 p-2">{children}</td>,
};

interface ArtigoResponse {
    success: boolean;
    artigo: {
        slug: string;
        title: string;
        categoria: string;
        resumo: string;
        conteudo: string;
    };
}

interface ModalArtigoBaseConhecimentoProps {
    isOpen: boolean;
    slug: string | null;
    onClose: () => void;
}

async function fetchArtigo(slug: string): Promise<ArtigoResponse> {
    const response = await fetch(`/api/base-conhecimento/${slug}`);
    if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.error ?? 'Erro ao carregar artigo');
    }
    return response.json();
}

export function ModalArtigoBaseConhecimento({
    isOpen,
    slug,
    onClose,
}: ModalArtigoBaseConhecimentoProps) {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['artigo-base-conhecimento', slug],
        queryFn: () => fetchArtigo(slug as string),
        enabled: isOpen && !!slug,
    });

    if (!isOpen) return null;

    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-200 ease-out">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out">
                {/* ========== HEADER ========== */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-4">
                        <FaBook className="flex-shrink-0 text-white" size={36} />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-xl font-extrabold">
                                {data?.artigo.title ?? 'Carregando...'}
                            </h1>
                            {data?.artigo.categoria && (
                                <p className="text-xs font-semibold tracking-widest text-teal-100">
                                    {data.artigo.categoria}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="mr-1 flex-shrink-0 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:bg-red-500 hover:shadow-xl hover:shadow-black active:scale-95"
                        aria-label="Fechar modal"
                    >
                        <IoClose className="text-white" size={30} />
                    </button>
                </header>

                {/* ========== CONTEÚDO ========== */}
                <div className="flex-1 overflow-y-auto px-8 py-8">
                    {isLoading && (
                        <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                            Carregando artigo...
                        </p>
                    )}

                    {isError && (
                        <p className="text-center text-sm font-semibold tracking-widest text-red-600 select-none">
                            {error instanceof Error ? error.message : 'Erro ao carregar artigo.'}
                        </p>
                    )}

                    {data && (
                        <article className="flex flex-col gap-3">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={MARKDOWN_COMPONENTS}
                            >
                                {data.artigo.conteudo}
                            </ReactMarkdown>
                        </article>
                    )}
                </div>
            </div>
        </div>
    );
}
