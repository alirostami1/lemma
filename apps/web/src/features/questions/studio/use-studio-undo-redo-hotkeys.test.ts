import { describe, expect, it } from "vitest";
import { getStudioHistoryShortcut } from "./use-studio-undo-redo-hotkeys";

describe("studio undo/redo shortcuts", () => {
  it("maps platform shortcuts", () => {
    expect(createShortcut({ key: "z", metaKey: true })).toBe("undo");
    expect(createShortcut({ key: "z", ctrlKey: true, shiftKey: true })).toBe(
      "redo",
    );
    expect(createShortcut({ key: "y", ctrlKey: true })).toBe("redo");
  });

  it("ignores unsafe shortcut contexts", () => {
    expect(createShortcut({ key: "z" })).toBeNull();
    expect(createShortcut({ key: "z", metaKey: true, altKey: true })).toBeNull();
    expect(
      createShortcut({ key: "z", metaKey: true, defaultPrevented: true }),
    ).toBeNull();
  });
});

function createShortcut(
  input: Partial<Parameters<typeof getStudioHistoryShortcut>[0]>,
) {
  return getStudioHistoryShortcut({
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key: "",
    metaKey: false,
    shiftKey: false,
    target: null,
    ...input,
  });
}
