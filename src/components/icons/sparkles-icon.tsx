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

const SparklesIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
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
      // main sparkle
      animate(
        ".sparkle-main",
        { rotate: 180, scale: [1, 1.2, 1] },
        { duration: 0.6, ease: "easeInOut" },
      );

      // top sparkle
      animate(
        ".sparkle-top",
        {
          rotate: -90,
          scale: [1, 0.8, 1.1],
          opacity: [1, 0.6, 1],
        },
        { duration: 0.5, ease: "easeInOut", delay: 0.1 },
      );

      // bottom sparkle
      animate(
        ".sparkle-bottom",
        {
          rotate: 90,
          scale: [1, 1.15, 0.9],
          opacity: [1, 0.7, 1],
        },
        { duration: 0.5, ease: "easeInOut", delay: 0.05 },
      );
    }, [animate, scope]);

    const stop = useCallback(() => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      animate(".sparkle-main", { rotate: 0, scale: 1 }, { duration: 0.25 });
      animate(
        ".sparkle-top",
        { rotate: 0, scale: 1, opacity: 1 },
        { duration: 0.25 },
      );
      animate(
        ".sparkle-bottom",
        { rotate: 0, scale: 1, opacity: 1 },
        { duration: 0.25 },
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
        {/* bottom sparkle */}
        <motion.path
          className="sparkle-bottom"
          d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z"
          style={{ transformOrigin: "18px 18px" }}
        />

        {/* top sparkle */}
        <motion.path
          className="sparkle-top"
          d="M16 6a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z"
          style={{ transformOrigin: "18px 6px" }}
        />

        {/* main sparkle */}
        <motion.path
          className="sparkle-main"
          d="M9 18a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z"
          style={{ transformOrigin: "9px 12px" }}
        />
      </motion.svg>
    );
  },
);

SparklesIcon.displayName = "SparklesIcon";
export default SparklesIcon;
