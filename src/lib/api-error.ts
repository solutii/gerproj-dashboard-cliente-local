// Mensagem de erro segura para respostas de API: só expõe o detalhe real
// (mensagem do driver Firebird, etc.) em desenvolvimento. Em produção,
// evita vazar nomes de tabela/coluna ou fragmentos de SQL para o cliente.
export function safeErrorMessage(
    error: unknown,
    fallback = 'Erro desconhecido'
): string | undefined {
    if (process.env.NODE_ENV !== 'development') return undefined;
    return error instanceof Error ? error.message : fallback;
}
