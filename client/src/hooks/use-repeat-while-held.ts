import { useCallback, useEffect, useRef } from "react";

const DEFAULT_INITIAL_DELAY = 400;
const DEFAULT_REPEAT_INTERVAL = 80;

/**
 * Returns pointer handlers so that while the pointer is held down,
 * `callback` runs once immediately, then again after `initialDelay` ms,
 * then repeatedly every `repeatInterval` ms until the pointer is released.
 */
export function useRepeatWhileHeld(
  callback: () => void,
  options?: { initialDelay?: number; repeatInterval?: number }
) {
  const { initialDelay = DEFAULT_INITIAL_DELAY, repeatInterval = DEFAULT_REPEAT_INTERVAL } = options ?? {};
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // only primary button
      clear();
      callbackRef.current();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        intervalRef.current = setInterval(() => {
          callbackRef.current();
        }, repeatInterval);
      }, initialDelay);
    },
    [initialDelay, repeatInterval, clear]
  );

  const onPointerUp = useCallback(() => clear(), [clear]);
  const onPointerLeave = useCallback(() => clear(), [clear]);
  const onPointerCancel = useCallback(() => clear(), [clear]);

  useEffect(() => () => clear(), [clear]);

  return { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel };
}
