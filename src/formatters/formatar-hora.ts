// Função para formatar hora com sufixos "h", "hs" e "min"
export const formatarHora = (
  timeString: string | null | undefined,
): string => {
  if (!timeString) {
    return '-';
  }

  const cleanTime = timeString.trim();
  let hours: number;
  let minutes: number;

  // Verifica se é formato HH:MM:SS (15:00:00)
  if (cleanTime.includes(':')) {
    const parts = cleanTime.split(':');
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
  }
  // Verifica se é formato HHMM (1500)
  else if (/^\d{4}$/.test(cleanTime)) {
    hours = parseInt(cleanTime.substring(0, 2), 10);
    minutes = parseInt(cleanTime.substring(2, 4), 10);
  }
  // Formato não reconhecido
  else {
    return '-';
  }

  // Validação dos valores
  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return '-';
  }

  const horasFormatadas = hours.toString().padStart(2, '0');
  const minutosFormatados = minutes.toString().padStart(2, '0');


  return `${horasFormatadas}:${minutosFormatados}`;
};
// ====================================================================================================

export const formatarHorasArredondadas = (
  value: string | number | null | undefined,
): string => {
  if (value == null) return '-';

  const { hours, minutes } = parseTimeValueArredondadas(value);

  // Validação final
  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return '-';
  }

  // Arredonda com base nos minutos
  let horasArredondadas = hours;
  
  if (minutes >= 30) {
    horasArredondadas += 1; // Arredonda para cima
  }
  // Se minutes < 30, mantém as horas (arredonda para baixo)

  // Retorna apenas as horas com sufixo
  if (horasArredondadas === 1) {
    return `${horasArredondadas}h`;
  } else {
    return `${horasArredondadas}hs`;
  }
};

// Função auxiliar para extrair horas e minutos
const parseTimeValueArredondadas = (value: string | number): { hours: number; minutes: number } => {
  let hours = 0;
  let minutes = 0;

  if (typeof value === 'number') {
    return parseDecimalTimeArredondadas(value);
  }

  const cleanValue = value.trim();

  // Formato "HH:MM" ou "HH:MM:SS"
  if (cleanValue.includes(':')) {
    const parts = cleanValue.split(':');
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
  }
  // Formato decimal como string "12.5" ou "12,5"
  else if (cleanValue.includes('.') || cleanValue.includes(',')) {
    const numericValue = parseFloat(cleanValue.replace(',', '.'));
    if (!isNaN(numericValue)) {
      return parseDecimalTimeArredondadas(numericValue);
    }
  }
  // Formato "HHMM" (4 dígitos)
  else if (/^\d{4}$/.test(cleanValue)) {
    hours = parseInt(cleanValue.substring(0, 2), 10) || 0;
    minutes = parseInt(cleanValue.substring(2, 4), 10) || 0;
  }
  // Apenas número como string "125" (minutos totais)
  else if (/^\d+$/.test(cleanValue)) {
    const totalMinutes = parseInt(cleanValue, 10);
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;
  }

  return { hours, minutes };
};

// Função auxiliar para converter número decimal em horas e minutos
const parseDecimalTimeArredondadas = (value: number): { hours: number; minutes: number } => {
  let hours = Math.floor(value);
  const decimalPart = value - hours;
  let minutes = Math.round(decimalPart * 60);

  // Ajuste para casos onde minutos podem ser 60 (devido ao arredondamento)
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }

  return { hours, minutes };
};

// Função para formatar horas totais com sufixos "h", "hs" e "min"
export const formatarHorasTotaisSufixo = (
  value: string | number | null | undefined,
): string => {
  if (value == null) return '-';

  const { hours, minutes } = parseTimeValue(value);

  // Validação final
  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return '-';
  }

  // Formata a saída
  return formatTimeOutput(hours, minutes);
};

// Função auxiliar para extrair horas e minutos
const parseTimeValue = (value: string | number): { hours: number; minutes: number } => {
  let hours = 0;
  let minutes = 0;

  if (typeof value === 'number') {
    return parseDecimalTime(value);
  }

  const cleanValue = value.trim();

  // Formato "HH:MM" ou "HH:MM:SS"
  if (cleanValue.includes(':')) {
    const parts = cleanValue.split(':');
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
  }
  // Formato decimal como string "12.5" ou "12,5"
  else if (cleanValue.includes('.') || cleanValue.includes(',')) {
    const numericValue = parseFloat(cleanValue.replace(',', '.'));
    if (!isNaN(numericValue)) {
      return parseDecimalTime(numericValue);
    }
  }
  // Formato "HHMM" (4 dígitos)
  else if (/^\d{4}$/.test(cleanValue)) {
    hours = parseInt(cleanValue.substring(0, 2), 10) || 0;
    minutes = parseInt(cleanValue.substring(2, 4), 10) || 0;
  }
  // Apenas número como string "125" (minutos totais)
  else if (/^\d+$/.test(cleanValue)) {
    const totalMinutes = parseInt(cleanValue, 10);
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;
  }

  return { hours, minutes };
};

// Função auxiliar para converter número decimal em horas e minutos
const parseDecimalTime = (value: number): { hours: number; minutes: number } => {
  let hours = Math.floor(value);
  const decimalPart = value - hours;
  let minutes = Math.round(decimalPart * 60);

  // Ajuste para casos onde minutos podem ser 60 (devido ao arredondamento)
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }

  return { hours, minutes };
};

// Função auxiliar para formatar número com separador de milhar
const formatarNumeroComMilhar = (num: number): string => {
  return num.toLocaleString('pt-BR');
};

// Função auxiliar para formatar a saída
const formatTimeOutput = (hours: number, minutes: number): string => {
  const hoursFormatted = formatarNumeroComMilhar(hours);
  
  // Apenas minutos
  if (hours === 0) {
    return `${minutes}min`;
  }

  // Apenas horas (sem minutos)
  if (minutes === 0) {
    return hours === 1 ? '1h':`${hoursFormatted}hs`;
  }

  // Horas e minutos
  const minutesStr = minutes.toString().padStart(2, '0');
  return hours === 1 
    ? `1h:${minutesStr}min` 
    : `${hoursFormatted}hs:${minutesStr}min`;
};
// ====================================================================================================

export const formatarDiferencaHoras = (diferenca: number): string => {
  // Se a diferença for muito pequena (menos de 0.5h), retorna "No prazo"
  if (Math.abs(diferenca) < 0.5) {
    return 'No prazo';
  }

  // Converte o decimal em horas e minutos
  const horas = Math.floor(Math.abs(diferenca));
  const minutos = Math.round((Math.abs(diferenca) - horas) * 60);

  // Formata a string
  let resultado = '';
  
  if (horas > 0 && minutos > 0) {
    // Ex: 2hs:30min ou 1h:30min
    resultado = `${horas}${horas === 1 ? 'h' : 'hs'}:${minutos}min`;
  } else if (horas > 0) {
    // Ex: 2hs ou 1h
    resultado = `${horas}${horas === 1 ? 'h' : 'hs'}`;
  } else if (minutos > 0) {
    // Ex: 30min (sem horas)
    resultado = `${minutos}min`;
  }

  // Adiciona o sinal de + ou - conforme necessário
  if (diferenca > 0) {
    return `+${resultado}`;
  } else if (diferenca < 0) {
    return `-${resultado}`;
  }

  return resultado;
};
