import { FileAliasUnavailableError, fileId } from "../domain/index.js";
import type { FileReferenceGuardPort, FilesRepository } from "./ports.js";

export class FileReferenceGuard implements FileReferenceGuardPort {
  constructor(private readonly repository: FilesRepository) {}

  async assertFileAliasReferenceableForUpdate(
    fileIdValue: string,
  ): Promise<void> {
    const file = await this.repository.findFileByIdForUpdate(
      fileId(fileIdValue),
    );
    if (!file) {
      throw new FileAliasUnavailableError();
    }
    if (file.status !== "uploaded") {
      throw new FileAliasUnavailableError();
    }
  }
}
