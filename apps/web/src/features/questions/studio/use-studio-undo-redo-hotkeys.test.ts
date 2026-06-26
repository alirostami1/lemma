import { describe, expect, it } from "vitest";
import {
  getStudioHistoryShortcut,
  type StudioHistoryShortcutEvent,
} from "./use-studio-undo-redo-hotkeys";

describe("studio undo/redo shortcuts", () => {
  it("maps platform shortcuts", () => {
    expect(createShortcut({ key: "z", metaKey: true })).toBe("undo");
    expect(createShortcut({ ctrlKey: true, key: "z", shiftKey: true })).toBe(
      "redo",
    );
    expect(createShortcut({ ctrlKey: true, key: "y" })).toBe("redo");
  });

  it("ignores unsafe shortcut contexts", () => {
    expect(createShortcut({ key: "z" })).toBeNull();
    expect(
      createShortcut({ altKey: true, key: "z", metaKey: true }),
    ).toBeNull();
    expect(
      createShortcut({ defaultPrevented: true, key: "z", metaKey: true }),
    ).toBeNull();
  });
});

function createShortcut(input: Partial<StudioHistoryShortcutEvent>) {
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
