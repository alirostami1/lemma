import assert from "node:assert/strict";
import test from "node:test";
import {
  validateBrowserOnlyImportSpecifiers,
  validateBrowserViteConfig,
  validatePackageExports,
  validateWorkspaceImportSpecifiers,
} from "./check-package-boundaries.mjs";

test('catches browser Vite configs with global resolve.conditions "source"', () => {
  const issues = validateBrowserViteConfig({
    filePath: "apps/web/vite.config.ts",
    text: `
      export default defineConfig({
        resolve: {
          conditions: ["source", "browser"],
        },
      });
    `,
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /must not set global resolve\.conditions/u);
});

test("catches browser app imports from package src internals", () => {
  const issues = validateWorkspaceImportSpecifiers({
    filePath: "apps/web/src/example.ts",
    text: 'import { value } from "@lemma/foo/src/internal";',
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /not package internals/u);
});

test("rejects browser-only package imports from non-browser package code", () => {
  const issues = validateBrowserOnlyImportSpecifiers({
    filePath: "packages/notifications/src/domain/notification-channel.ts",
    text: 'import { isUuidString } from "@lemma/domain/browser";',
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /Browser-only package exports/u);
});

test("accepts browser-only package imports from package browser modules", () => {
  const issues = validateBrowserOnlyImportSpecifiers({
    filePath: "packages/notifications/src/browser/notification-channel.ts",
    text: 'import { isUuidString } from "@lemma/domain/browser";',
  });

  assert.deepEqual(issues, []);
});

test("accepts browser-only package imports from browser apps", () => {
  const issues = validateBrowserOnlyImportSpecifiers({
    filePath: "apps/web/src/domains/realtime/channels.ts",
    text: 'import { userNotificationChannel } from "@lemma/notifications/browser";',
  });

  assert.deepEqual(issues, []);
});

test("catches missing browser condition on the domain root export", () => {
  const issues = validatePackageExports({
    filePath: "packages/domain/package.json",
    packageJson: {
      name: "@lemma/domain",
      exports: {
        ".": {
          types: "./src/index.ts",
          source: "./src/index.ts",
          import: "./dist/index.js",
          default: "./dist/index.js",
        },
      },
    },
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /root export must expose browser-safe source/u);
});

test("rejects browser subpath exports without a browser condition", () => {
  const issues = validatePackageExports({
    filePath: "packages/http/package.json",
    packageJson: {
      name: "@lemma/http",
      exports: {
        "./browser": {
          types: "./src/browser.ts",
          source: "./src/browser.ts",
          import: "./src/browser.ts",
          default: "./src/browser.ts",
        },
      },
    },
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /must define an explicit browser condition/u);
});

test("rejects browser subpath exports with browser pointing at dist", () => {
  const issues = validatePackageExports({
    filePath: "packages/http/package.json",
    packageJson: {
      name: "@lemma/http",
      exports: {
        "./browser": {
          types: "./src/browser.ts",
          browser: "./dist/browser.js",
          source: "./src/browser.ts",
          import: "./src/browser.ts",
          default: "./src/browser.ts",
        },
      },
    },
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /browser condition must point at source/u);
});

test("rejects browser subpath exports with import or default pointing at dist", () => {
  const issues = validatePackageExports({
    filePath: "packages/http/package.json",
    packageJson: {
      name: "@lemma/http",
      exports: {
        "./browser": {
          types: "./src/browser.ts",
          browser: "./src/browser.ts",
          source: "./src/browser.ts",
          import: "./dist/browser.js",
          default: "./dist/browser.js",
        },
      },
    },
  });

  assert.equal(issues.length, 2);
  assert.match(issues[0].message, /import must not point only at dist/u);
  assert.match(issues[1].message, /default must not point only at dist/u);
});

test("accepts domain and browser subpath exports with browser-safe source conditions", () => {
  const issues = [
    ...validatePackageExports({
      filePath: "packages/domain/package.json",
      packageJson: {
        name: "@lemma/domain",
        exports: {
          ".": {
            types: "./src/index.ts",
            browser: "./src/index.ts",
            source: "./src/index.ts",
            import: "./dist/index.js",
            default: "./dist/index.js",
          },
          "./browser": {
            types: "./src/index.ts",
            browser: "./src/index.ts",
            source: "./src/index.ts",
            import: "./src/index.ts",
            default: "./src/index.ts",
          },
        },
      },
    }),
    ...validatePackageExports({
      filePath: "packages/notifications/package.json",
      packageJson: {
        name: "@lemma/notifications",
        exports: {
          "./browser": {
            types: "./src/browser/index.ts",
            browser: "./src/browser/index.ts",
            source: "./src/browser/index.ts",
            import: "./src/browser/index.ts",
            default: "./src/browser/index.ts",
          },
        },
      },
    }),
  ];

  assert.deepEqual(issues, []);
});
