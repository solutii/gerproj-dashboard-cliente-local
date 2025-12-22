import { useCallback, useEffect, useRef, useState } from 'react';

export const useRedimensionarColunas = (initialWidths: Record<string, number>) => {
  const [columnWidths, setColumnWidths] = useState(initialWidths);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const initialWidthsRef = useRef(initialWidths);

  // Atualiza a referência se initialWidths mudar
  useEffect(() => {
    initialWidthsRef.current = initialWidths;
  }, [initialWidths]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, columnId: string) => {
      e.preventDefault();
      e.stopPropagation();

      setResizingColumn(columnId);
      startXRef.current = e.clientX;
      startWidthRef.current = columnWidths[columnId];

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [columnWidths],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingColumn) return;

      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(50, startWidthRef.current + diff);

      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    },
    [resizingColumn],
  );

  const handleMouseUp = useCallback(() => {
    setResizingColumn(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // ✅ NOVA FUNÇÃO: Reseta a largura da coluna ao tamanho original
  const handleDoubleClick = useCallback((columnId: string) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: initialWidthsRef.current[columnId],
    }));
  }, []);

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingColumn, handleMouseMove, handleMouseUp]);

  return {
    columnWidths,
    handleMouseDown,
    handleDoubleClick, // ✅ NOVO RETORNO
    resizingColumn,
  };
};