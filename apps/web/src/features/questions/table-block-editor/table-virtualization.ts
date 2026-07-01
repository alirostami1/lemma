export type VirtualAxisItem<T> = {
  item: T;
  index: number;
  offset: number;
  size: number;
};

export type VirtualAxisWindow<T> = {
  items: VirtualAxisItem<T>[];
  totalSize: number;
};

export function getVirtualAxisWindow<T>(input: {
  items: readonly T[];
  itemSize: number;
  scrollOffset: number;
  viewportSize: number;
  overscan: number;
}): VirtualAxisWindow<T> {
  const totalSize = input.items.length * input.itemSize;
  if (input.items.length === 0) {
    return { items: [], totalSize };
  }

  const safeViewportSize = Math.max(input.viewportSize, input.itemSize);
  const safeOffset = Math.min(
    Math.max(0, input.scrollOffset),
    Math.max(0, totalSize - safeViewportSize),
  );
  const startIndex = Math.max(
    0,
    Math.floor(safeOffset / input.itemSize) - input.overscan,
  );
  const visibleCount = Math.ceil(safeViewportSize / input.itemSize);
  const endIndex = Math.min(
    input.items.length - 1,
    Math.floor(safeOffset / input.itemSize) + visibleCount + input.overscan,
  );

  const virtualItems: VirtualAxisItem<T>[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const item = input.items[index];
    if (item === undefined) {
      continue;
    }
    virtualItems.push({
      index,
      item,
      offset: index * input.itemSize,
      size: input.itemSize,
    });
  }

  return {
    items: virtualItems,
    totalSize,
  };
}
