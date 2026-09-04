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

export interface TrashIconProps extends AnimatedIconProps {
  shakeOnClick?: boolean;
  dangerHover?: boolean;
  keepOpenOnDelete?: boolean;
}

const TrashIcon = forwardRef<AnimatedIconHandle, TrashIconProps>(
  (
    {
      shakeOnClick = false,
      dangerHover = false,
      keepOpenOnDelete = false,
      size = 24,
      color = "currentColor",
      strokeWidth = 2,
      className = "",
    },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const openLid = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      await Promise.all([
        animate(
          ".trash-lid-lower",
          { rotate: -25, y: -4 },
          { duration: 0.25, ease: "easeOut" },
        ),
        animate(
          ".trash-lid-upper",
          { rotate: -35, y: -6, x: -2 },
          { duration: 0.25, ease: "easeOut" },
        ),
      ]);
    }, [animate, scope]);

    const closeLid = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      await Promise.all([
        animate(
          ".trash-lid-lower",
          { rotate: 0, y: 0 },
          { duration: 0.2, ease: "easeInOut" },
        ),
        animate(
          ".trash-lid-upper",
          { rotate: 0, y: 0, x: 0 },
          { duration: 0.2, ease: "easeInOut" },
        ),
      ]);
    }, [animate, scope]);

    const dangerHoverAnimation = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      if (!dangerHover) return;

      await animate(
        ".trash-icon",
        { stroke: "#ef4444" },
        { duration: 0.2, delay: 0.1, ease: "easeInOut" },
      );
    }, [animate, dangerHover, scope]);

    const resetColor = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      if (!dangerHover) return;

      await animate(
        ".trash-icon",
        { stroke: "currentColor" },
        { duration: 0.2, ease: "easeInOut" },
      );
    }, [animate, dangerHover, scope]);

    const hoverAnimation = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      await openLid();
      await dangerHoverAnimation();
    }, [openLid, dangerHoverAnimation, scope]);

    const hoverEndAnimation = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      resetColor();
      closeLid();
    }, [resetColor, closeLid, scope]);

    const clickAnimation = useCallback(async () => {
      // Nothing to animate once the icon has left the page: motion fires a
      // hover-end on an unmounting element, and `animate` on an empty scope
      // throws. See the note in `rail-mark.tsx`.
      if (!scope.current) return;
      if (shakeOnClick) {
        await animate(
          ".trash-icon",
          { x: [0, -2, 2, -1, 0] },
          { duration: 0.25, ease: "easeInOut" },
        );
      }

      if (keepOpenOnDelete) {
        await openLid();
      }
    }, [shakeOnClick, keepOpenOnDelete, animate, openLid, scope]);

    useImperativeHandle(ref, () => ({
      startAnimation: openLid,
      stopAnimation: closeLid,
    }));

    return (
      <motion.svg
        ref={scope}
        className={`cursor-pointer ${className} trash-icon`}
        onHoverStart={hoverAnimation}
        onHoverEnd={hoverEndAnimation}
        onTap={clickAnimation}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />

        <motion.path
          d="M4 7l16 0"
          className="trash-lid-lower"
          style={{ transformOrigin: "50% 100%" }}
        />

        <path d="M10 11l0 6" />
        <path d="M14 11l0 6" />
        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />

        <motion.path
          d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"
          className="trash-lid-upper"
          style={{ transformOrigin: "50% 100%" }}
        />
      </motion.svg>
    );
  },
);

TrashIcon.displayName = "TrashIcon";
export default TrashIcon;
