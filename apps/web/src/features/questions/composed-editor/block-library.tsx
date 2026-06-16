import { InsertBlockMenu, type InsertBlockType } from "./insert-block-menu";

export function BlockLibrary({
  disabled,
  onInsert,
}: {
  disabled?: boolean;
  onInsert(type: InsertBlockType): void;
}) {
  return <InsertBlockMenu disabled={disabled} onInsert={onInsert} />;
}
