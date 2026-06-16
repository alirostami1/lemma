import type { DatabaseExecutor } from "@lemma/db";
import {
  type Clock,
  FileContentReader,
  FilesService,
  type FilesServiceConfig,
  type IdGenerator,
} from "./application/index.js";
import type { RequireIdentity } from "./http/index.js";
import { filesRoutes } from "./http/index.js";
import {
  KyselyFilesRepository,
  S3FileStorage,
  type S3FileStorageConfig,
} from "./infrastructure/index.js";

export function createFilesModule(deps: {
  db: DatabaseExecutor;
  requireIdentity: RequireIdentity;
  idGenerator: IdGenerator;
  clock: Clock;
  config: FilesServiceConfig;
  storageConfig: S3FileStorageConfig;
}) {
  const filesRepository = new KyselyFilesRepository(deps.db);

  const storage = new S3FileStorage(deps.storageConfig);

  const filesService = new FilesService({
    filesRepository,
    fileStorage: storage,
    idGenerator: deps.idGenerator,
    clock: deps.clock,
    config: deps.config,
  });
  const fileContentReaderPort = new FileContentReader({
    filesRepository,
    fileStorage: storage,
  });

  const routes = filesRoutes({
    requireIdentity: deps.requireIdentity,
    filesService,
  });

  return { routes, filesService, fileContentReaderPort };
}
