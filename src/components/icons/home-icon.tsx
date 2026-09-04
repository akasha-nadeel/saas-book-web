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

const HomeIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
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
      animate(
        ".roof",
        { y: [-2, 0], opacity: [0.6, 1] },
        { duration: 0.4, ease: "easeOut" },
      );
      await animate(
        ".house",
        { scale: [0.95, 1] },
        { duration: 0.3, ease: "easeOut" },
      );
      animate(".door", { scaleY: [0, 1] }, { duration: 0.3, ease: "easeOut" });
    }, [animate, scope]);

    const stop = useCallback(() => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      animate(
        ".roof, .house, .door",
        { y: 0, opacity: 1, scale: 1, scaleY: 1 },
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
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <motion.path className="roof" d="M5 12l-2 0l9 -9l9 9l-2 0" />
        <motion.path
          className="house"
          style={{ transformOrigin: "center" }}
          d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"
        />
        <motion.path
          className="door"
          style={{ transformOrigin: "center bottom" }}
          d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"
        />
      </motion.svg>
    );
  },
);

HomeIcon.displayName = "HomeIcon";
export default HomeIcon;
