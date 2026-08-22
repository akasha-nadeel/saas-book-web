import { describe, expect, it } from "vitest";
import { editorLayoutFor } from "./editor-layout";

describe("editorLayoutFor", () => {
  it.each([
    [320, 568],
    [767, 1200],
    [568, 320],
    [800, 360],
    [1023, 559],
  ])("uses a continuous canvas at %d×%d", (width, height) => {
    expect(editorLayoutFor({ width, height }).mode).toBe("continuous");
  });

  it.each([
    [768, 560],
    [820, 1180],
    [1024, 559],
    [1280, 800],
  ])("uses paged layout at %d×%d", (width, height) => {
    expect(editorLayoutFor({ width, height }).mode).toBe("paged");
  });

  it("adds the tool rail and navigator at their exact boundaries", () => {
    expect(editorLayoutFor({ width: 1023, height: 800 })).toMatchObject({
      persistentToolRail: false,
      persistentBookNavigator: false,
    });
    expect(editorLayoutFor({ width: 1024, height: 800 })).toMatchObject({
      persistentToolRail: true,
      persistentBookNavigator: false,
    });
    expect(editorLayoutFor({ width: 1279, height: 800 })).toMatchObject({
      persistentBookNavigator: false,
    });
    expect(editorLayoutFor({ width: 1280, height: 800 })).toMatchObject({
      persistentBookNavigator: true,
    });
  });
});
