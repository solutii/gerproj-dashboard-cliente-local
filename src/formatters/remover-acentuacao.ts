// Função para remover acentos de uma string
export const removerAcentos = (texto: string): string => {
   return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};
// ====================================================================================================

/**
 * Retorna apenas os dois primeiros nomes de uma string de nome completo.
 * Ex: "João Pedro da Silva" -> "Joao Pedro"
 */
export const renderizarDoisPrimeirosNomes = (nomeCompleto?: string | null): string => {
   if (!nomeCompleto) return '';
   const semAcentos = removerAcentos(nomeCompleto);
   const partes = semAcentos.trim().split(/\s+/).filter(Boolean);
   return partes.slice(0, 2).join(' ');
};