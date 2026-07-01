import { describe, expect, it } from "vitest";
import { getVirtualAxisWindow } from "./table-virtualization";

describe("getVirtualAxisWindow", () => {
  it("returns only visible items plus bounded overscan", () => {
    const items = Array.from({ length: 200 }, (_, index) => `item_${index}`);

    const window = getVirtualAxisWindow({
      itemSize: 50,
      items,
      overscan: 2,
      scrollOffset: 5_000,
      viewportSize: 500,
    });

    expect(window.totalSize).toBe(10_000);
    expect(window.items[0]).toEqual({
      index: 98,
      item: "item_98",
      offset: 4_900,
      size: 50,
    });
    expect(window.items.at(-1)?.index).toBe(112);
    expect(window.items.length).toBeLessThan(items.length);
  });

  it("clamps negative offsets and the final window to valid items", () => {
    const items = ["first", "middle", "last"];

    expect(
      getVirtualAxisWindow({
        itemSize: 40,
        items,
        overscan: 1,
        scrollOffset: -100,
        viewportSize: 40,
      }).items.map((item) => item.index),
    ).toEqual([0, 1, 2]);
    expect(
      getVirtualAxisWindow({
        itemSize: 40,
        items,
        overscan: 1,
        scrollOffset: 10_000,
        viewportSize: 40,
      }).items.map((item) => item.index),
    ).toEqual([1, 2]);
  });
});
