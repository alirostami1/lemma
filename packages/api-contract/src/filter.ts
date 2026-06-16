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

const retainedComponentSections = componentSections.filter(
  (section) => section !== "securitySchemes",
);

export function pickOpenAPIPaths({
  document,
  paths: selectedPaths,
}: {
  document: OpenAPI;
  paths: readonly string[];
}): OpenAPI {
  const selectedPathSet = new Set(selectedPaths);
  const paths = Object.fromEntries(
    Object.entries(document.paths ?? {}).filter(([path]) =>
      selectedPathSet.has(path),
    ),
  );

  for (const path of selectedPaths) {
    if (paths[path] === undefined) {
      throw new Error(`Missing OpenAPI path: ${path}`);
    }
  }

  return pruneComponents({
    ...document,
    paths,
  });
}

function pruneComponents(document: OpenAPI): OpenAPI {
  const refs = collectReachableRefs(document, document.paths ?? {});
  const components: Components = {};

  for (const section of retainedComponentSections) {
    const source = document.components?.[section];
    if (source === undefined) {
      continue;
    }

    const retained = Object.fromEntries(
      Object.entries(source).filter(([name]) => refs.has(refKey(section, name))),
    );

    if (Object.keys(retained).length > 0) {
      components[section] = retained as never;
    }
  }

  if (document.components?.securitySchemes !== undefined) {
    components.securitySchemes = { ...document.components.securitySchemes };
  }

  return {
    ...document,
    components,
  };
}

function collectReachableRefs(root: OpenAPI, value: unknown): Set<string> {
  const refs = new Set<string>();
  const queue: string[] = [];

  collectRefs(value, queue);

  while (queue.length > 0) {
    const ref = queue.shift();
    if (ref === undefined || refs.has(ref)) {
      continue;
    }

    refs.add(ref);
    const component = resolveComponentRef(root, ref);
    if (component !== undefined) {
      collectRefs(component, queue);
    }
  }

  return refs;
}

function collectRefs(value: unknown, refs: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRefs(item, refs);
    }
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (
      key === "$ref" &&
      typeof entry === "string" &&
      entry.startsWith("#/components/")
    ) {
      refs.push(entry);
      continue;
    }

    collectRefs(entry, refs);
  }
}

function resolveComponentRef(root: unknown, ref: string): unknown {
  if (root === null || typeof root !== "object") {
    return undefined;
  }

  const [section, name] = parseComponentRef(ref);
  if (section === undefined || name === undefined) {
    return undefined;
  }

  const components = (root as OpenAPI).components;
  const sectionEntries = components?.[section] as
    | Record<string, unknown>
    | undefined;
  return sectionEntries?.[name];
}

function parseComponentRef(
  ref: string,
): [ComponentSectionName | undefined, string | undefined] {
  const prefix = "#/components/";
  if (!ref.startsWith(prefix)) {
    return [undefined, undefined];
  }

  const [section, name] = ref.slice(prefix.length).split("/");
  if (section === undefined || name === undefined) {
    return [undefined, undefined];
  }

  return [section as ComponentSectionName, name];
}

function refKey(section: ComponentSectionName, name: string): string {
  return `#/components/${section}/${name}`;
}
