import { Loader2 } from 'lucide-react';
import { FaDatabase } from 'react-icons/fa';

interface LoadingOverlayProps {
  isLoading: boolean;
  title: string;
  icon?: React.ReactNode;
}

export function IsLoading({ isLoading, title, icon }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm duration-300">
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
            <span className="text-xl font-semibold tracking-widest text-white italic select-none">
              Carregando informações
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
