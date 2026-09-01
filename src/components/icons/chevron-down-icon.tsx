"use client";

/*
 * In the style of the itshover set beside it (https://itshover.com,
 * Apache-2.0), but written here rather than vendored: itshover has no chevron
 * and the rail needed one for the show/hide toggle on the manuscript's body
 * card. Same shape as the vendored files — a `motion.svg` on a 24 grid taking
 * `currentColor`, with the motion driven from an imperative handle so the
 * button can start it, since the glyph is small inside its target and most of
 * a hover never touches it.
 *
 * **Drawn pointing down, and rotated by the caller when the list is open.** A
 * disclosure chevron says which way the thing will move, so it has to answer to
 * the state — and rotating the wrapper is how the rest of the app does it. The
 * animation is a nudge in the direction it points, which is the itshover house
 * move for a directional glyph.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const ChevronDownIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();
    const isAnimatingRef = useRef(false);

    const start = useCallback(async () => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      while (isAnimatingRef.current && scope.current) {
        await animate(
          ".chevron",
          { y: [0, 3, 0] },
          { duration: 0.5, ease: "easeInOut" },
        );
        if (!isAnimatingRef.current || !scope.current) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }, [animate, scope]);

    const stop = useCallback(() => {
      isAnimatingRef.current = false;
      if (!scope.current) return;
      animate(".chevron", { y: 0 }, { duration: 0.2 });
    }, [animate, scope]);

    /**
     * **Stop the loop when the glyph goes away.**
     *
     * `start` runs `while (isAnimatingRef.current)`, so a hover that is still
     * cycling when the icon unmounts keeps going — and the next `animate` call
     * reaches for a scope that is no longer in the document, which throws
     * `Cannot read properties of null (reading 'querySelectorAll')`. That is
     * easy to hit here: these two sit on a card header that unmounts them the
     * moment the card shrinks to a strip, which is exactly what pressing the
     * button they are on does.
     *
     * The vendored itshover icons have the same shape and the same latent
     * hole; they have not hit it because nothing unmounts them mid-hover.
     */
    useEffect(
      () => () => {
        isAnimatingRef.current = false;
      },
      [],
    );

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    return (
      <motion.svg
        ref={scope}
        onHoverStart={start}
        onHoverEnd={stop}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ overflow: "visible" }}
      >
        <motion.path
          className="chevron"
          d="m6 9 6 6 6-6"
          style={{ transformOrigin: "center" }}
        />
      </motion.svg>
    );
  },
);

ChevronDownIcon.displayName = "ChevronDownIcon";
export default ChevronDownIcon;
