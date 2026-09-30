import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Expense, Language } from '../types';
import { ExpenseItemCard } from './ExpenseItemCard';
import { clampSwipeOffset, isSwipeDeleteArmed, swipeDeleteProgress } from '../utils/historyView';
import { wp17Copy } from '../utils/wp17Copy';

interface SwipeableExpenseCardProps {
  expense: Expense;
  currencyCode: string;
  language: Language;
  attachmentCount: number;
  onOpen: () => void;
  onRequestDelete: () => void;
}

export const SwipeableExpenseCard: React.FC<SwipeableExpenseCardProps> = ({
  expense,
  currencyCode,
  language,
  attachmentCount,
  onOpen,
  onRequestDelete,
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [holding, setHolding] = useState(false);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const horizontalRef = useRef(false);
  const offsetRef = useRef(0);
  const suppressClickUntilRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isRtl = language === 'ar';

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const clearHold = () => {
    if (holdTimerRef.current != null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setHolding(false);
  };

  useEffect(() => () => clearHold(), []);

  const reset = () => {
    clearHold();
    setDragging(false);
    offsetRef.current = 0;
    setOffsetX(0);
    startRef.current = null;
    horizontalRef.current = false;
  };

  const armHoldAnimation = () => {
    clearHold();
    if (reducedMotion) return;
    holdTimerRef.current = window.setTimeout(() => {
      if (horizontalRef.current) setHolding(true);
    }, 420);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    horizontalRef.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (!horizontalRef.current) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.85) {
        reset();
        return;
      }
      const semanticDistance = (isRtl ? 1 : -1) * dx;
      if (semanticDistance <= 0) return;
      horizontalRef.current = true;
      suppressClickUntilRef.current = Date.now() + 450;
      armHoldAnimation();
    }

    const nextOffset = clampSwipeOffset(dx, isRtl);
    offsetRef.current = nextOffset;
    setOffsetX(nextOffset);
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || startRef.current.pointerId !== event.pointerId) return;
    const width = rootRef.current?.clientWidth || 320;
    const armed = horizontalRef.current && isSwipeDeleteArmed(offsetRef.current, width, isRtl);
    if (horizontalRef.current) suppressClickUntilRef.current = Date.now() + 500;
    reset();
    if (armed) onRequestDelete();
  };

  const width = rootRef.current?.clientWidth || 320;
  const progress = swipeDeleteProgress(offsetX, width, isRtl);
  const armed = isSwipeDeleteArmed(offsetX, width, isRtl);
  const revealWidth = Math.max(54, Math.min(132, Math.abs(offsetX) + 10));

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden rounded-2xl"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={reset}
    >
      <div
        className={`absolute inset-y-0 ${isRtl ? 'left-0' : 'right-0'} bg-rose-600 dark:bg-rose-700 flex items-center justify-center text-white`}
        style={{ width: revealWidth, opacity: Math.max(0.18, progress) }}
        aria-hidden="true"
      >
        <Trash2
          className={`w-5 h-5 ${holding && !armed ? 'animate-pulse' : ''} ${armed ? 'scale-110' : ''}`}
        />
      </div>

      <div
        style={{ transform: `translate3d(${offsetX}px,0,0)` }}
        className={`${dragging ? '' : reducedMotion ? '' : 'transition-transform duration-200 ease-out'}`}
        onClickCapture={(event) => {
          if (Date.now() < suppressClickUntilRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <ExpenseItemCard
          expense={expense}
          currencyCode={currencyCode}
          language={language}
          attachmentCount={attachmentCount}
          onClick={onOpen}
          onDeleteClick={onRequestDelete}
          deleteLabel={wp17Copy(language, 'deleteAction')}
        />
      </div>
    </div>
  );
};
