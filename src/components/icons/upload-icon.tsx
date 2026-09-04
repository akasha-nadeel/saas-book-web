"use client";

/*
 * Vendored from itshover (https://itshover.com, Apache-2.0) rather than pulled
 * with `shadcn add`: this repo has no `components.json`, and `shadcn init`
 * would rewrite `globals.css` with shadcn's own token set over the `@theme`
 * block the whole app is coloured from. The components use hooks and carry no
 * directive of their own, so one is added above.
 *
 * **One behaviour is edited: every animation callback returns early on an empty
 * scope.** Motion fires a hover-end on an element that is unmounting, and
 * `animate` against a scope whose ref has already been cleared throws
 * `Cannot read properties of null (reading 'querySelectorAll')`. Hovering a rail
 * icon and then hiding the rail — entering focus mode, or leaving the editor —
 * is all it takes. Nothing here can catch it from outside, since the throw is
 * inside motion's own callback.
 */
import { forwardRef, useImperativeHandle, useCallback, useRef } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const UploadIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();
    const isAnimatingRef = useRef(false);

    const start = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      while (isAnimatingRef.current) {
        // 1. Fly Up and Fade Out
        await animate(
          ".arrow-group",
          { y: -12, opacity: 0 },
          { duration: 0.4, ease: "easeIn" },
        );

        if (!isAnimatingRef.current) break;

        // 2. Instant Reset to Bottom
        await animate(".arrow-group", { y: 12, opacity: 0 }, { duration: 0 });

        // 3. Fly In from Bottom to Center
        await animate(
          ".arrow-group",
          { y: 0, opacity: 1 },
          { duration: 0.4, ease: "easeOut" },
        );

        if (!isAnimatingRef.current) break;

        // Small pause at center for "intention"
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }, [animate, scope]);

    const stop = useCallback(() => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      isAnimatingRef.current = false;
      animate(
        ".arrow-group",
        { y: 0, opacity: 1 },
        { duration: 0.3, ease: "easeOut" },
      );
    }, [animate, scope]);

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
        {/* Base bracket */}
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />

        {/* Arrow (Main & Only) */}
        <motion.g className="arrow-group">
          <path d="M12 3v12" />
          <path d="m17 8-5-5-5 5" />
        </motion.g>
      </motion.svg>
    );
  },
);

UploadIcon.displayName = "UploadIcon";
export default UploadIcon;
