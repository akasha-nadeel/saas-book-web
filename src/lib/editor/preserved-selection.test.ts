import { describe, expect, it } from "vitest";
import { clampEditorSelection } from "./preserved-selection";

describe("clampEditorSelection", () => {
  it("keeps a valid range unchanged", () => {
    expect(clampEditorSelection({ from: 4, to: 12 }, 20)).toEqual({
      from: 4,
      to: 12,
    });
  });

  it("keeps a saved panel selection valid after the document shrinks", () => {
    expect(clampEditorSelection({ from: 14, to: 30 }, 18)).toEqual({
      from: 14,
      to: 18,
    });
    expect(clampEditorSelection({ from: 22, to: 30 }, 18)).toEqual({
      from: 18,
      to: 18,
    });
  });
});
