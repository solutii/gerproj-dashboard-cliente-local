import { formatarHora } from '@/formatters/formatar-hora';
import { useEffect, useState } from 'react';
import { IoMdClock } from 'react-icons/io';

// Componente separado para o relógio
export function Relogio() {
  const [horaAtual, setHoraAtual] = useState(
    new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  );

  useEffect(() => {
    const intervalo = setInterval(() => {
      setHoraAtual(
        new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 text-xl font-extrabold tracking-widest select-none text-black">
      <IoMdClock className="text-black" size={32} />
      {formatarHora(horaAtual)}
    </div>
  );
}
