'use client';

import { useEffect, useState } from 'react';
import { MdAccessTime } from 'react-icons/md';

export function Relogio() {
    const [horaAtual, setHoraAtual] = useState('');

    useEffect(() => {
        // Define a hora inicial
        setHoraAtual(
            new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            })
        );

        // Atualiza a cada segundo
        const intervalo = setInterval(() => {
            setHoraAtual(
                new Date().toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                })
            );
        }, 1000);

        // Cleanup: limpa o intervalo quando o componente desmontar
        return () => clearInterval(intervalo);
    }, []); // ✅ Array de dependências vazio - executa apenas uma vez

    return (
        <div className="flex items-center gap-2 text-base font-extrabold tracking-widest text-black select-none">
            <MdAccessTime className="text-black" size={24} />
            {horaAtual || '--:--:--'}
        </div>
    );
}
