// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  canRunStudioShortcutFromSurface,
  getStudioShortcutSurface,
  isStudioShortcutSuppressedTarget,
  STUDIO_SHORTCUT_HELP_NOTES,
} from "./studio-keybindings";

describe("Studio keybindings", () => {
  it("documents table selection shortcut reservations", () => {
    expect(STUDIO_SHORTCUT_HELP_NOTES).toContain(
      "Some key combinations are left free for table editing.",
    );
  });

  it("suppresses Studio shortcuts from text entry surfaces", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const editor = document.createElement("div");
    const combobox = document.createElement("button");
    const grid = document.createElement("div");
    const cell = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    combobox.setAttribute("role", "combobox");
    grid.setAttribute("role", "grid");
    cell.setAttribute("role", "cell");

    expect(isStudioShortcutSuppressedTarget(input)).toBe(true);
    expect(isStudioShortcutSuppressedTarget(textarea)).toBe(true);
    expect(isStudioShortcutSuppressedTarget(editor)).toBe(true);
    expect(isStudioShortcutSuppressedTarget(combobox)).toBe(true);
    expect(isStudioShortcutSuppressedTarget(grid)).toBe(true);
    expect(isStudioShortcutSuppressedTarget(cell)).toBe(true);
  });

  it("allows Studio shortcuts from the editor shell", () => {
    const shell = document.createElement("button");
    shell.dataset.studioShortcutScope = "block";

    expect(isStudioShortcutSuppressedTarget(shell)).toBe(false);
    expect(getStudioShortcutSurface(shell)).toBe("block");
    expect(
      canRunStudioShortcutFromSurface({
        action: "navigate_next_block",
        surface: "block",
      }),
    ).toBe(true);
  });

  it("does not allow block navigation from primary editing fields", () => {
    const textarea = document.createElement("textarea");
    textarea.dataset.studioShortcutScope = "editing";

    expect(getStudioShortcutSurface(textarea)).toBe("editing");
    expect(
      canRunStudioShortcutFromSurface({
        action: "navigate_next_block",
        surface: "editing",
      }),
    ).toBe(false);
    expect(
      canRunStudioShortcutFromSurface({
        action: "open_commands",
        surface: "editing",
      }),
    ).toBe(false);
    expect(
      canRunStudioShortcutFromSurface({
        action: "confirm_edit",
        surface: "editing",
      }),
    ).toBe(true);
  });
});
