'use client';

import { useCarregamentoInicial } from '@/hooks/useCarregamentoInicial';
import { IsLoading } from './IsLoading';

// Renderizar como ÚLTIMO filho da página (ver useCarregamentoInicial).
export function OverlayCarregamentoInicial({ title }: { title: string }) {
    const carregando = useCarregamentoInicial();
    return <IsLoading isLoading={carregando} title={title} fade={false} />;
}
