import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workbookTempFileName = "workbook.xlsx";

export async function withWorkbookTempFile<T>(
  input: { bytes: Uint8Array },
  operation: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "lemma-workbook-"));
  const path = join(dir, workbookTempFileName);
  try {
    await writeFile(path, input.bytes);
    return await operation(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
