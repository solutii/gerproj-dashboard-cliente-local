export function corrigirTextoCorrompido(
  texto: string | null | undefined,
): string {
  if (!texto) return '';

  // Se o texto não tiver caracteres suspeitos, retorna como está
  const suspeitos = /[ÃãÂâÊêÔôÛûÇç©§�ýÝ]/;
  if (!suspeitos.test(texto)) return texto;

  try {
    // Primeira tentativa — corrigir encoding UTF-8 lido como Latin1
    const corrigido = decodeURIComponent(escape(texto));

    // Se após correção ainda tiver caracteres estranhos, faz substituições manuais
    if (/�|ý/.test(corrigido) || /Ã|Â|Ê|Ô|Û/.test(corrigido)) {
      return corrigirManual(corrigido);
    }

    return corrigido;
  } catch {
    // Fallback em caso de erro
    return corrigirManual(texto);
  }
}

/**
 * Substitui manualmente caracteres corrompidos comuns.
 * Útil quando o decodeURIComponent falha parcialmente.
 */
function corrigirManual(texto: string): string {
  const mapa: Record<string, string> = {
    // Acentos minúsculos
    'Ã¡': 'á',
    'Ã ': 'à',
    'Ã¢': 'â',
    'Ã£': 'ã',
    'Ãª': 'ê',
    'Ã©': 'é',
    'Ã¨': 'è',
    'Ã§': 'ç',
    'Ã³': 'ó',
    'Ã´': 'ô',
    'Ãº': 'ú',
    'Ã¼': 'ü',
    'Ã­': 'í',
    
    // Acentos maiúsculos
    'Ã"': 'Ó',
    'Ã‰': 'É',
    'Ã€': 'À',
    'ÃŠ': 'Ê',
    'Ã‡': 'Ç',
    'Ã': 'Á',
    
    // Pontuação
    'â€"': '–',
    'â€œ': '"',
    'â€�': '"',
    'â€˜': "'",
    'â€™': "'",
    'â€¢': '•',
    'â€¦': '…',
    
    // Símbolos
    'Âº': 'º',
    'Âª': 'ª',
    'Â°': '°',
    'Â': '',
    
    // Casos específicos
    '�O': 'ÃO',
    '�A': 'ÇA',
    '�NIO': 'ÔNIO',
    'Tý': 'TÔ',
    'ýý': 'ÇÃ',  // ✅ EVOLUÇÃO
    'Dý': 'DÃ', 
    'ý': 'Ç',
    '�ÃO': 'ÇÃO',
    '�ncia': 'ência'
  };

  let corrigido = texto;
  
  // Aplica as substituições do mapa (ordem importa!)
  for (const [errado, certo] of Object.entries(mapa)) {
    corrigido = corrigido.replaceAll(errado, certo);
  }

  return corrigido;
}