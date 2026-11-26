import { useCallback, useRef } from 'react';

interface Point {
  x: number;
  y: number;
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Returns true if point p lies inside triangle (a, b, c). */
export function isPointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = cross(p, a, b);
  const d2 = cross(p, b, c);
  const d3 = cross(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Desktop multi-level menu helper implementing open delay, close delay,
 * and a geometric safe triangle toward the submenu panel.
 */
export function useSafeTriangleMenu(openDelayMs = 120, closeDelayMs = 220) {
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const lastPointer = useRef<Point | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(
    (cb: () => void) => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      openTimer.current = window.setTimeout(() => {
        openTimer.current = null;
        cb();
      }, openDelayMs);
    },
    [openDelayMs]
  );

  const scheduleClose = useCallback(
    (cb: () => void) => {
      if (openTimer.current !== null) {
        window.clearTimeout(openTimer.current);
        openTimer.current = null;
      }
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = null;
        cb();
      }, closeDelayMs);
    },
    [closeDelayMs]
  );

  const shouldHoldSubmenu = useCallback((nextPoint: Point, submenuEl: HTMLElement | null): boolean => {
    const prev = lastPointer.current;
    lastPointer.current = nextPoint;
    if (!prev || !submenuEl) return false;
    const rect = submenuEl.getBoundingClientRect();
    const topLeft: Point = { x: rect.left, y: rect.top };
    const bottomLeft: Point = { x: rect.left, y: rect.bottom };
    return isPointInTriangle(nextPoint, prev, topLeft, bottomLeft);
  }, []);

  return {
    clearTimers,
    scheduleOpen,
    scheduleClose,
    shouldHoldSubmenu,
    recordPointer: (x: number, y: number) => {
      lastPointer.current = { x, y };
    },
  };
}
