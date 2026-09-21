'use client';

import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/**
 * true enquanto a página faz a carga inicial dos dados; vira false (e não
 * volta) quando as buscas terminam. Serve para páginas com várias queries
 * independentes (ex.: dashboard) manterem UM overlay até tudo carregar.
 *
 * Precisa ser usado num componente renderizado DEPOIS (irmão posterior) dos
 * que fazem as queries: os efeitos rodam na ordem da árvore, então no efeito
 * de montagem as queries anteriores já começaram a buscar. Se nenhuma está
 * buscando (tudo em cache), não há o que esperar e o overlay já sai.
 */
export function useCarregamentoInicial(): boolean {
    const queryClient = useQueryClient();
    const buscando = useIsFetching();
    const [pronto, setPronto] = useState(false);
    const iniciou = useRef(false);

    useEffect(() => {
        if (queryClient.isFetching() === 0) setPronto(true);
        else iniciou.current = true;
    }, [queryClient]);

    useEffect(() => {
        if (buscando > 0) iniciou.current = true;
        else if (iniciou.current) setPronto(true);
    }, [buscando]);

    return !pronto;
}
