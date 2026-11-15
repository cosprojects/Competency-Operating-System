"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import {
  FINE_POINTER_QUERY,
  REDUCED_MOTION_QUERY,
  followFactor,
} from "@/lib/motion/tokens";

interface BaseProps {
  className?: string;
  children: ReactNode;
  /** Для доступности, когда подпись — иконка. */
  ariaLabel?: string;
}

type PrimaryCtaProps =
  | (BaseProps & { href: string; onClick?: () => void })
  | (BaseProps & { href?: undefined; onClick?: () => void; type?: "button" | "submit" });

const REST_X = 50;
const REST_Y = 50;

/**
 * Главная кнопка-действие (COS-EAR-016) — единственный выразительный акцент
 * интерфейса. Идея Liquid Carve Button сохранена: свет follows курсор. Но к
 * языку COS приведена жёстко — без goo-фильтра и вычитающей маски, без spring
 * и отскока, индиго вместо акцентного красного.
 *
 * Подсветка лежит ПОД текстом (`::before`, `z-index: -1`), поэтому контраст
 * надписи не зависит от положения курсора. На тач-устройствах и при
 * `prefers-reduced-motion` слой просто не двигается (центр, без слежения).
 */
export function PrimaryCta(props: PrimaryCtaProps) {
  const { className, children, ariaLabel, onClick } = props;
  const href = "href" in props ? props.href : undefined;
  const type = "type" in props && props.type ? props.type : "button";

  const elementRef = useRef<HTMLElement | null>(null);
  const chase = useRef({ x: REST_X, y: REST_Y, tx: REST_X, ty: REST_Y, frame: 0, last: 0 });

  useEffect(() => {
    const chaseRef = chase.current;
    return () => {
      if (chaseRef.frame) window.cancelAnimationFrame(chaseRef.frame);
      chaseRef.frame = 0;
    };
  }, []);

  function canTrack(): boolean {
    if (typeof window === "undefined") return false;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false;
    return window.matchMedia(FINE_POINTER_QUERY).matches;
  }

  function tick(time: number): void {
    const state = chase.current;
    state.frame = 0;
    const element = elementRef.current;
    if (!element) return;

    const dt = state.last ? Math.min(0.05, (time - state.last) / 1000) : 1 / 60;
    state.last = time;
    const k = followFactor(dt);
    state.x += (state.tx - state.x) * k;
    state.y += (state.ty - state.y) * k;

    element.style.setProperty("--cta-x", `${state.x.toFixed(2)}%`);
    element.style.setProperty("--cta-y", `${state.y.toFixed(2)}%`);

    if (Math.abs(state.tx - state.x) < 0.05 && Math.abs(state.ty - state.y) < 0.05) {
      state.x = state.tx;
      state.y = state.ty;
      state.last = 0;
      return;
    }
    state.frame = window.requestAnimationFrame(tick);
  }

  function schedule(): void {
    const state = chase.current;
    if (state.frame) return;
    state.frame = window.requestAnimationFrame(tick);
  }

  function moveTo(event: React.PointerEvent<HTMLElement>): void {
    if (!canTrack()) return;
    if (event.pointerType && event.pointerType !== "mouse") return;
    const element = elementRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const state = chase.current;
    state.tx = ((event.clientX - rect.left) / rect.width) * 100;
    state.ty = ((event.clientY - rect.top) / rect.height) * 100;
    schedule();
  }

  function handleEnter(event: React.PointerEvent<HTMLElement>): void {
    if (!canTrack()) return;
    const element = elementRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const state = chase.current;
        // Входим в кнопку сразу в точке курсора: подсветка не «догоняет» с края.
        state.x = ((event.clientX - rect.left) / rect.width) * 100;
        state.y = ((event.clientY - rect.top) / rect.height) * 100;
        element.style.setProperty("--cta-x", `${state.x.toFixed(2)}%`);
        element.style.setProperty("--cta-y", `${state.y.toFixed(2)}%`);
      }
    }
    moveTo(event);
  }

  function handleLeave(): void {
    const state = chase.current;
    if (state.frame) window.cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.last = 0;
    state.tx = REST_X;
    state.ty = REST_Y;
  }

  const shared = {
    className: `cta-primary${className ? ` ${className}` : ""}`,
    "aria-label": ariaLabel,
    onPointerEnter: handleEnter,
    onPointerMove: moveTo,
    onPointerLeave: handleLeave,
    onPointerCancel: handleLeave,
  };

  if (href) {
    return (
      <Link
        {...shared}
        href={href}
        onClick={onClick}
        ref={(element) => {
          elementRef.current = element;
        }}
      >
        <span className="cta-primary-label">{children}</span>
      </Link>
    );
  }

  return (
    <button
      {...shared}
      type={type}
      onClick={onClick}
      ref={(element) => {
        elementRef.current = element;
      }}
    >
      <span className="cta-primary-label">{children}</span>
    </button>
  );
}
