import React from 'react';

interface ResizeHandleProps {
  columnId: string;
  onMouseDown: (e: React.MouseEvent, columnId: string) => void;
  onDoubleClick: (columnId: string) => void; // ✅ NOVA PROP
  isResizing: boolean;
}

export const RedimensionarColunas: React.FC<ResizeHandleProps> = ({
  columnId,
  onMouseDown,
  onDoubleClick, // ✅ NOVA PROP
  isResizing,
}) => (
  <div
    className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/60 transition-colors group ${
      isResizing ? 'bg-white' : ''
    }`}
    onMouseDown={(e) => onMouseDown(e, columnId)}
    onDoubleClick={() => onDoubleClick(columnId)} // ✅ NOVA FUNCIONALIDADE
    title="Arraste para redimensionar | Duplo clique para resetar" // ✅ TOOLTIP
    style={{ zIndex: 15 }}
  >
    {/* Área clicável maior para facilitar o resize */}
    <div className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5" />
    
    {/* Indicador visual ao hover */}
    <div 
      className={`absolute right-0 top-0 bottom-0 w-0.5 transition-colors ${
        isResizing 
          ? 'bg-purple-400' // ✅ Cor quando está redimensionando
          : 'bg-white/0 group-hover:bg-white/80' // Cor normal e hover
      }`} 
    />
    
    {/* ✅ NOVO: Indicador central para melhor visibilidade */}
    <div 
      className={`absolute right-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition-all ${
        isResizing 
          ? 'bg-purple-500 scale-110' 
          : 'bg-transparent group-hover:bg-white/90'
      }`}
    />
  </div>
);