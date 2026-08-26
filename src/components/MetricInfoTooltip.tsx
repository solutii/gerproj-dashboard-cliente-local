// src/components/MetricInfoTooltip.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';

interface MetricInfoTooltipProps {
    title: string;
    description: string;
    accentColor?: string; // classe Tailwind de cor do ícone (ex: 'text-blue-600')
}

// Precisa ser renderizado dentro de um ancestral com `position: relative`
// (o container do card) — o popover se centraliza sobre esse ancestral via
// `absolute inset-0`, não sobre o próprio ícone.
export function MetricInfoTooltip({
    title,
    description,
    accentColor = 'text-blue-600',
}: MetricInfoTooltipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div ref={containerRef} className="contents">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
                title="O que é esta métrica?"
                aria-label="O que é esta métrica?"
                className={`cursor-pointer transition-transform duration-150 hover:scale-125 active:scale-95 ${accentColor}`}
            >
                <FaInfoCircle size={22} />
            </button>

            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 absolute inset-0 z-30 flex items-start justify-center px-4 pt-10 duration-150">
                    <div className="animate-in zoom-in-95 w-full max-w-xs rounded-lg bg-black p-5 text-left shadow-2xl shadow-black duration-150">
                        <p className="mb-2 text-sm font-extrabold tracking-widest text-white uppercase select-none">
                            {title}
                        </p>
                        <p className="text-sm leading-relaxed font-medium tracking-wide text-gray-300 select-none">
                            {description}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
