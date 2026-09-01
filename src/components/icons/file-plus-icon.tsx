"use client";

/*
 * In the style of the itshover set beside it (https://itshover.com,
 * Apache-2.0), written here for the same reason as the chevron: the set has no
 * "add a page" glyph and the body card needed one when its New chapter button
 * lost its label.
 *
 * **A page with a plus, not a bare plus.** The button sits beside a chevron on
 * a card whose subject is chapters; a lone `+` there could add anything. The
 * sheet is what says *a chapter*, and the plus is what says *another one*.
 *
 * The motion is the plus drawing itself onto the page — the itshover move for
 * a glyph whose verb is "make".
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

const FilePlusIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
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
        animate(
          ".plus-across",
          { scaleX: [0, 1] },
          { duration: 0.35, ease: "backOut" },
        );
        await animate(
          ".plus-down",
          { scaleY: [0, 1] },
          { duration: 0.35, ease: "backOut" },
        );

        if (!isAnimatingRef.current || !scope.current) break;

        // A breath on the sheet, so the page reads as the thing being added to.
        await animate(
          ".sheet",
          { scale: [1, 1.04, 1] },
          { duration: 0.3, ease: "easeOut" },
        );

        if (!isAnimatingRef.current || !scope.current) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }, [animate, scope]);

    const stop = useCallback(() => {
      isAnimatingRef.current = false;
      if (!scope.current) return;
      animate(
        ".plus-across, .plus-down, .sheet",
        { scaleX: 1, scaleY: 1, scale: 1 },
        { duration: 0.2 },
      );
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
        {/* The sheet, with its folded corner. */}
        <motion.path
          className="sheet"
          d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8z"
          style={{ transformOrigin: "center" }}
        />
        <motion.path className="sheet" d="M14 3v5a1 1 0 0 0 1 1h4" />

        {/* The plus, drawn on. */}
        <motion.path
          className="plus-across"
          d="M9 15h6"
          style={{ transformOrigin: "center" }}
        />
        <motion.path
          className="plus-down"
          d="M12 12v6"
          style={{ transformOrigin: "center" }}
        />
      </motion.svg>
    );
  },
);

FilePlusIcon.displayName = "FilePlusIcon";
export default FilePlusIcon;
