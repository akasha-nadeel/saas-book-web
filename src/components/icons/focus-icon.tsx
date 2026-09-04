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
import { motion, useAnimate } from "motion/react";

const FocusIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
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
      animate(".center", { scale: 1.4 }, { duration: 0.25, ease: "easeOut" });

      animate(".corners", { scale: 0.85 }, { duration: 0.25, ease: "easeOut" });
    }, [animate, scope]);

    const stop = useCallback(() => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      animate(
        ".center, .corners",
        { scale: 1 },
        { duration: 0.2, ease: "easeInOut" },
      );
    }, [animate, scope]);

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    return (
      <motion.svg
        ref={scope}
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
        onHoverStart={start}
        onHoverEnd={stop}
      >
        <motion.circle
          className="center"
          cx="12"
          cy="12"
          r="3"
          style={{ transformOrigin: "12px 12px" }}
        />
        <motion.path className="corners" d="M3 7V5a2 2 0 0 1 2-2h2" />
        <motion.path className="corners" d="M17 3h2a2 2 0 0 1 2 2v2" />
        <motion.path className="corners" d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <motion.path className="corners" d="M7 21H5a2 2 0 0 1-2-2v-2" />
      </motion.svg>
    );
  },
);

FocusIcon.displayName = "FocusIcon";
export default FocusIcon;
