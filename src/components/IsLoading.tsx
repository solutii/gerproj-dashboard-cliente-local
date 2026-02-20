import { Loader2 } from 'lucide-react';
import { FaDatabase } from 'react-icons/fa';

interface LoadingOverlayProps {
    isLoading: boolean;
    title: string;
    icon?: React.ReactNode;
}

export function IsLoading({ isLoading, title, icon }: LoadingOverlayProps) {
    if (!isLoading) return null;

    const text = 'aguarde, carregando informações';

    return (
        <div className="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm duration-200">
            <div className="flex flex-col items-center justify-center gap-6">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-200 via-blue-400 to-blue-600 opacity-20 blur-xl"></div>

                    <div className="relative flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600" size={160} />

                        <div className="absolute inset-0 flex items-center justify-center">
                            {icon || <FaDatabase className="text-blue-600" size={60} />}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-4">
                    <h1 className="text-3xl font-extrabold tracking-widest text-white select-none">
                        {title}
                    </h1>

                    <div className="flex items-center justify-center gap-1">
                        <span className="flex text-xl font-semibold tracking-widest text-white italic select-none">
                            {text.split('').map((char, index) => (
                                <span
                                    key={index}
                                    className="animate-[bounce_1s_ease-in-out_infinite]"
                                    style={{
                                        animationDelay: `${index * 0.05}s`,
                                        display: 'inline-block',
                                        minWidth: char === ' ' ? '0.25em' : 'auto',
                                    }}
                                >
                                    {char === ' ' ? '\u00A0' : char}
                                </span>
                            ))}
                        </span>
                        <div className="flex items-center justify-center gap-1">
                            <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-white"></span>
                            <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_0.2s_infinite] rounded-full bg-white"></span>
                            <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_0.4s_infinite] rounded-full bg-white"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
