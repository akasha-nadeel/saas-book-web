"use client";

import { useSyncExternalStore } from "react";
import {
  getAmbience,
  getServerAmbience,
  isAmbienceSupported,
  subscribeToAmbience,
  type AmbienceState,
} from "./ambience";

/**
 * React's view of the sound engine — kept apart from it so the engine stays
 * framework-free, the same split the library store uses.
 */
export function useAmbience(): AmbienceState {
  return useSyncExternalStore(
    subscribeToAmbience,
    getAmbience,
    getServerAmbience,
  );
}

const NEVER_CHANGES = () => () => {};
const NOT_ON_SERVER = () => false;

/**
 * Whether this browser has the Web Audio API at all. Read the way `useHydrated`
 * is: the server says no and the client fills it in, with no effect setting
 * state to do it.
 */
export function useAmbienceSupported(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    isAmbienceSupported,
    NOT_ON_SERVER,
  );
}
