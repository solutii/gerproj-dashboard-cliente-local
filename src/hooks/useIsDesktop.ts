// src/hooks/useIsDesktop.ts
'use client';

import { useEffect, useState } from 'react';

const DESKTOP_BREAKPOINT = 1024;

/**
 * true a partir de 1024px (lg) — abaixo disso (tablet/celular) o CSS `zoom`
 * usado nos layouts é desligado, porque Safari não suporta `zoom` e o
 * comportamento entre navegadores é inconsistente fora de desktop.
 */
export function useIsDesktop(): boolean {
    const [isDesktop, setIsDesktop] = useState(true);

    useEffect(() => {
        const check = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    return isDesktop;
}
