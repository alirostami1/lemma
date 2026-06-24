import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(dirname, "../../packages/ui");
const webRoot = path.join(dirname, "src");
const RESOLVED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function resolveHashImport(baseDirectory: string, source: string) {
  const modulePath = source.replace(/^#\/+/, "");
  const absolutePath = path.resolve(baseDirectory, modulePath);
  const directFile = RESOLVED_EXTENSIONS.find((extension) =>
    fs.existsSync(`${absolutePath}${extension}`),
  );

  if (directFile) {
    return `${absolutePath}${directFile}`;
  }

  const stat = (() => {
    try {
      return fs.statSync(absolutePath);
    } catch {
      return null;
    }
  })();

  if (!stat?.isDirectory()) return absolutePath;

  const indexFile = RESOLVED_EXTENSIONS.find((extension) =>
    fs.existsSync(path.join(absolutePath, `index${extension}`)),
  );

  return indexFile
    ? path.join(absolutePath, `index${indexFile}`)
    : absolutePath;
}

function isPathInDirectory(importer: string, directory: string) {
  const normalizedImporter = path.normalize(importer);
  const normalizedDirectory = path.normalize(directory);
  return (
    normalizedImporter === normalizedDirectory ||
    normalizedImporter.startsWith(`${normalizedDirectory}${path.sep}`)
  );
}

function isUiSourceFile(importer: string) {
  const normalizedImporter = path.normalize(importer);
  return (
    isPathInDirectory(normalizedImporter, uiRoot) ||
    normalizedImporter.includes(
      `${path.sep}node_modules${path.sep}@lemma${path.sep}ui${path.sep}`,
    ) ||
    normalizedImporter.includes(`${path.sep}@lemma${path.sep}ui${path.sep}`)
  );
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "#": webRoot,
    },
  },
  plugins: [
    {
      enforce: "pre",
      name: "web-shared-alias",
      resolveId(source, importer) {
        if (!source.startsWith("#/") || !importer) return null;
        const baseDirectory = isUiSourceFile(importer)
          ? path.join(uiRoot, "src")
          : webRoot;
        return resolveHashImport(baseDirectory, source);
      },
    },
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup-env.ts", "./src/test/setup.ts"],
  },
});
