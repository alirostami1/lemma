// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type StudioHistorySnapshot,
  useStudioHistory,
} from "./use-studio-history";

describe("useStudioHistory", () => {
  it("undoes and redoes snapshots", () => {
    const { result } = renderHook(() => useStudioHistory());
    const one = createSnapshot("one");
    const two = createSnapshot("two");
    let restored: StudioHistorySnapshot | null = null;

    act(() => {
      result.current.recordChange(one, two, "authoring_model");
    });

    expect(result.current.canUndo).toBe(true);
    act(() => {
      restored = result.current.undo(two);
    });

    expect(restored).toEqual(one);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      restored = result.current.redo(one);
    });

    expect(restored).toEqual(two);
  });

  it("coalesces repeated grouped edits", () => {
    const { result } = renderHook(() => useStudioHistory());
    const one = createSnapshot("one");
    const two = createSnapshot("two");
    const three = createSnapshot("three");
    let restored: StudioHistorySnapshot | null = null;

    act(() => {
      result.current.recordChange(one, two, "authoring_model");
      result.current.recordChange(two, three, "authoring_model");
    });
    act(() => {
      restored = result.current.undo(three);
    });

    expect(restored).toEqual(one);
  });
});

function createSnapshot(text: string): StudioHistorySnapshot {
  return {
    authoringModel: createModel(text),
    blueprintDescription: "",
    blueprintName: "Blueprint",
    selectedWorkbookId: "",
  };
}

function createModel(text: string): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks: [
      {
        id: "text_1",
        type: "text",
        content: [{ type: "text", text }],
      },
    ],
    responseFields: [],
    references: [],
  };
}
