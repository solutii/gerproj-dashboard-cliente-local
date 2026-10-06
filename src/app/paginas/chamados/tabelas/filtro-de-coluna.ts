// Reforço, no navegador, dos filtros de coluna da tabela de chamados (o servidor já filtrou a página; isto é idempotente).

// Uma linha passa no filtro se o texto do filtro está no valor da coluna (sem diferenciar maiúsculas). A busca de
// ASSUNTO_CHAMADO também vale para o NÚMERO do chamado: o servidor já a trata assim, e sem isto digitar um número
// descartava, na tela, o chamado que o servidor achou.
export function linhaPassaNoFiltroDeColuna(
    linha: { COD_CHAMADO?: number | string | null },
    filtro: { id: string; value: unknown }
): boolean {
    if (!filtro.value || (typeof filtro.value === 'string' && !filtro.value.trim())) return true;

    const valor = String(filtro.value).toUpperCase();
    if (filtro.id === 'ASSUNTO_CHAMADO' && String(linha.COD_CHAMADO ?? '').includes(valor))
        return true;

    const celula = (linha as Record<string, unknown>)[filtro.id];
    if (celula == null) return false;

    return String(celula).toUpperCase().includes(valor);
}
