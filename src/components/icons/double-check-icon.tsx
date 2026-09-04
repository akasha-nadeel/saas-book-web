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
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { scaledStrokeWidth } from "./types";
import { motion, useAnimate } from "motion/react";

const DoubleCheckIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      await animate(
        ".check-first",
        {
          pathLength: [0, 1],
          opacity: [0, 1],
        },
        {
          duration: 0.5,
          ease: "easeInOut",
        },
      );

      await animate(
        ".check-second",
        {
          pathLength: [0, 1],
          opacity: [0, 1],
        },
        {
          duration: 0.5,
          ease: "easeInOut",
        },
      );
    }, [animate, scope]);

    const stop = useCallback(() => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      animate(
        ".check-first, .check-second",
        { pathLength: 1, opacity: 1 },
        { duration: 0.2, ease: "easeInOut" },
      );
    }, [animate, scope]);

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    return (
      <motion.div
        ref={scope}
        className={`inline-flex cursor-pointer ${className}`}
        onHoverStart={start}
        onHoverEnd={stop}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          stroke={color}
          strokeWidth={scaledStrokeWidth(strokeWidth, 48)}
          strokeMiterlimit="10"
          strokeLinecap="square"
        >
          <motion.path
            className="check-first"
            style={{ transformOrigin: "19px 25px" }}
            d="M3 26.4L11.8846 39L35 11"
          />

          <motion.path
            className="check-second"
            style={{ transformOrigin: "33px 25px" }}
            d="M45 11L21.8847 39L20.2098 36.6248"
          />
        </svg>
      </motion.div>
    );
  },
);

DoubleCheckIcon.displayName = "DoubleCheckIcon";
export default DoubleCheckIcon;
