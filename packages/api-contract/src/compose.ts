import type { OpenAPI } from "@lemma/http/openapi";

type Components = NonNullable<OpenAPI["components"]>;
type ComponentSectionName = keyof Components;

const componentSections = [
  "schemas",
  "responses",
  "parameters",
  "examples",
  "requestBodies",
  "headers",
  "securitySchemes",
  "links",
  "callbacks",
  "pathItems",
] as const satisfies readonly ComponentSectionName[];

export function composeOpenAPI({
  base,
  fragments,
  pathPrefix,
}: {
  base: OpenAPI;
  fragments: readonly OpenAPI[];
  pathPrefix: string;
}): OpenAPI {
  const paths: OpenAPI["paths"] = { ...base.paths };
  const tags = [...(base.tags ?? [])];
  const components: Components = cloneComponents(base.components);

  for (const fragment of fragments) {
    for (const tag of fragment.tags ?? []) {
      if (!tags.some((existing) => existing.name === tag.name)) {
        tags.push(tag);
      }
    }

    for (const [path, pathItem] of Object.entries(fragment.paths ?? {})) {
      const prefixedPath = `${pathPrefix}${path}`;
      if (paths[prefixedPath] !== undefined) {
        throw new Error(`Duplicate OpenAPI path: ${prefixedPath}`);
      }
      paths[prefixedPath] = pathItem;
    }

    mergeComponents(components, fragment.components);
  }

  return {
    ...base,
    tags,
    paths,
    components,
  };
}

function cloneComponents(components: OpenAPI["components"]): Components {
  const clone: Components = {};

  for (const section of componentSections) {
    const entries = components?.[section];
    if (entries !== undefined) {
      clone[section] = { ...entries } as never;
    }
  }

  return clone;
}

function mergeComponents(
  target: Components,
  source: OpenAPI["components"],
): void {
  for (const section of componentSections) {
    const sourceEntries = source?.[section];
    if (sourceEntries === undefined) {
      continue;
    }

    const targetEntries = (target[section] ?? {}) as Record<string, unknown>;

    for (const [name, value] of Object.entries(sourceEntries)) {
      const existing = targetEntries[name];
      if (existing !== undefined && !jsonEqual(existing, value)) {
        throw new Error(
          `Conflicting OpenAPI component: components.${section}.${name}`,
        );
      }
      targetEntries[name] = value;
    }

    target[section] = targetEntries as never;
  }
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }

  return value;
}
