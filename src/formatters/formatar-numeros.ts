
export const formatarCodNumber = (num: number | null | undefined): string => {
   if (num == null) return '';
   // Intl já usa o separador de milhares adequado para 'de-DE' (ponto)
   return new Intl.NumberFormat('de-DE').format(num);
};
// ===================================================================================================

export const formatarCodString = (value: string | number | null | undefined): string => {
  if (!value && value !== 0) return '';
  
  // Garante conversão para string
  const stringValue = String(value);
  
  const onlyDigits = stringValue.replace(/\D/g, '');
  if (!onlyDigits) return '';
  
  return new Intl.NumberFormat('de-DE').format(Number(onlyDigits));
};
// ====================================================================================================

export function formatThousandsNumber(input: string): string {
   const numbersOnly = input.replace(/\D/g, '');
   if (numbersOnly.length === 0) return '';
   return numbersOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
// ====================================================================================================
