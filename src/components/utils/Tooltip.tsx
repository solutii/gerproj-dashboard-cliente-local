// components/TooltipTabela.tsx
'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { cloneElement, ReactElement, useEffect, useRef, useState } from 'react';

interface TooltipTabelaProps {
  content: string;
  children: ReactElement<any, any>;
  maxWidth?: string;
}

export function TooltipTabela({
  content,
  children,
  maxWidth = '200px',
}: TooltipTabelaProps) {
  const textRef = useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        const element = textRef.current;
        const isOverflowing = element.scrollWidth > element.clientWidth;

        console.log('🔍 Tooltip Check:', {
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          isTruncated: isOverflowing,
          content: content.substring(0, 30) + '...',
        });

        setIsTruncated(isOverflowing);
      }
    };

    // Aguardar renderização
    const timeoutId = setTimeout(checkOverflow, 100);

    // Observer para mudanças
    const observer = new ResizeObserver(checkOverflow);
    if (textRef.current) {
      observer.observe(textRef.current);
    }

    window.addEventListener('resize', checkOverflow);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [content]);

  // Se não há conteúdo
  if (!content || content.trim() === '') {
    return children;
  }

  // Clonar o children e adicionar a ref
  const childProps = (children.props ?? {}) as any;
  const childWithRef = cloneElement(children, {
    ref: textRef,
    style: { ...childProps.style, maxWidth },
  } as any);

  // Se não está truncado, retorna sem tooltip
  if (!isTruncated) {
    return childWithRef;
  }

  // Retorna com tooltip
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {cloneElement(children, {
            ref: textRef,
            className: `${childProps.className || ''} cursor-help`,
            style: { ...childProps.style, maxWidth },
          } as any)}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="end"
            className="z-[9999] max-w-[500px] break-words rounded-md bg-slate-900 px-4 py-3 text-sm text-white shadow-xl select-none tracking-wide font-medium"
            sideOffset={20}
          >
            {content}
            <Tooltip.Arrow className="fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
