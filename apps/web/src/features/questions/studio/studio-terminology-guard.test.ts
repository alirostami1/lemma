import * as ts from "typescript";
import { describe, expect, it } from "vitest";

type ScannedSource = {
  relativePath: string;
  sourceText: string;
};

type ScannedCopy = {
  relativePath: string;
  line: number;
  column: number;
  text: string;
};

type ForbiddenTerm = {
  term: string;
  pattern: RegExp;
};

type AllowedMatch = {
  relativePath: string;
  term: string;
  text: string;
  reason: string;
};

type BlockedMatch = ScannedCopy & { term: string };

// This guard protects normal Studio UI copy from implementation language.
// It scans JSX-visible text and copy-like string surfaces instead of every
// identifier, so internal route state, API models, domain terms, and DTO fields
// may still use implementation names where those names are real internals.
const INCLUDED_PATHS = [
  {
    path: "apps/web/src/routes/_layout.studio.tsx",
    reason: "Studio route shell.",
  },
  {
    path: "apps/web/src/features/questions/studio",
    reason: "Studio pages, dialogs, command bar, and view-model copy.",
  },
  {
    path: "apps/web/src/features/questions/composed-editor",
    reason: "Normal Studio authoring surface, including Add reference.",
  },
] as const;

const EXCLUDED_PATHS = [
  {
    pattern: /\.test\.[cm]?[tj]sx?$/u,
    reason:
      "Tests and fixtures may intentionally describe internal route/API state.",
  },
  {
    pattern: /(^|\/)__generated__(\/|$)|(^|\/)generated(\/|$)/u,
    reason: "Generated contracts are API internals, not authored UI copy.",
  },
] as const;

// Add an entry only when a user-facing Studio string intentionally needs one of
// the forbidden terms. Keep this list small and explain why the copy is safe.
const ALLOWED_MATCHES: AllowedMatch[] = [];

const FORBIDDEN_TERMS: ForbiddenTerm[] = [
  { pattern: /\bdrafts?\b/iu, term: "draft" },
  { pattern: /\bdraftId\b/iu, term: "draftId" },
  { pattern: /\brevisions?\b/iu, term: "revision" },
  { pattern: /\bexpectedRevision\b/iu, term: "expectedRevision" },
  { pattern: /\bsourceId\b/iu, term: "sourceId" },
  { pattern: /\bsource\s+IDs?\b/iu, term: "source ID" },
  { pattern: /\bfileId\b/iu, term: "fileId" },
  { pattern: /\bfile\s+IDs?\b/iu, term: "file ID" },
  { pattern: /\bworkbookId\b/iu, term: "workbookId" },
  { pattern: /\bworkbook\s+IDs?\b/iu, term: "workbook ID" },
  { pattern: /\bsource\s+bindings?\b/iu, term: "source binding" },
  { pattern: /\bsource\s+artifacts?\b/iu, term: "source artifact" },
  { pattern: /\breference\s+IDs?\b/iu, term: "reference ID" },
  { pattern: /\broute\s+intent\b/iu, term: "route intent" },
  { pattern: /\bserver\s+draft\b/iu, term: "server draft" },
  { pattern: /\{\{\s*\./u, term: "{{ ." },
];

const USER_FACING_JSX_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "description",
  "empty",
  "label",
  "message",
  "placeholder",
  "summary",
  "title",
]);

const COPY_PROPERTY_NAMES = new Set([
  "disabledReason",
  "description",
  "disabledIssue",
  "empty",
  "errorMessage",
  "generateDisabledReason",
  "label",
  "message",
  "metadata",
  "parseError",
  "placeholder",
  "reason",
  "submitLabel",
  "summary",
  "title",
  "validationIssue",
]);

const COPY_NAME_PATTERN =
  /(Copy|Description|Issue|Label|Message|Summary|Title|Placeholder|Reason|Error|Help|Hint|Caption|Tooltip|Empty)$/u;
const COPY_SETTER_PATTERN =
  /^set(?:[A-Z].*)?(Copy|Description|Issue|Label|Message|Summary|Title|Placeholder|Reason|Error|Help|Hint|Caption|Tooltip|Empty)$/u;

const ROUTE_SOURCE_MODULES = import.meta.glob<string>(
  "../../../routes/_layout.studio.tsx",
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
);
const STUDIO_SOURCE_MODULES = import.meta.glob<string>("./**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
});
const COMPOSED_EDITOR_SOURCE_MODULES = import.meta.glob<string>(
  "../composed-editor/**/*.{ts,tsx}",
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
);

describe("Studio terminology guard", () => {
  it("documents every explicit allowed match", () => {
    expect(
      getAllowedMatchDocumentationIssues(),
      "Every ALLOWED_MATCHES entry must have an exact path, term, normalized text, and non-empty reason.",
    ).toHaveLength(0);
  });

  it("keeps implementation terms out of normal Studio UI copy", () => {
    const sources = getScannedSources();
    expect(
      getMissingIncludedPaths(sources),
      "Every documented Studio UI scan path must be covered by the raw-source globs.",
    ).toHaveLength(0);

    const copy = sources.flatMap((source) =>
      extractUserFacingCopyFromSource(source),
    );
    const blockedMatches = copy.flatMap((item) => findBlockedMatches(item));

    expect(blockedMatches, formatBlockedMatches(blockedMatches)).toHaveLength(
      0,
    );
  });

  it("catches representative Studio UI copy leaks", () => {
    const leakCases = [
      {
        expectedTerm: "draft",
        name: "JSX visible text",
        source: "export function View() { return <div>Draft saved</div>; }",
      },
      {
        expectedTerm: "draft",
        name: "conditional JSX visible text",
        source:
          'export function View({ condition }) { return <div>{condition ? "Draft saved" : "Saved"}</div>; }',
      },
      {
        expectedTerm: "draft",
        name: "aria label",
        source:
          'export function View() { return <button aria-label="Open draft" />; }',
      },
      {
        expectedTerm: "draft",
        name: "title attribute",
        source: 'export function View() { return <button title="Draft" />; }',
      },
      {
        expectedTerm: "reference ID",
        name: "placeholder attribute",
        source:
          'export function View() { return <input placeholder="Enter reference ID" />; }',
      },
      {
        expectedTerm: "server draft",
        name: "message prop",
        source:
          'export function View() { return <InlineError message="Server draft failed" />; }',
      },
      {
        expectedTerm: "draft",
        name: "submit label prop",
        source:
          'export function View() { return <ReferenceCreateForm submitLabel="Add draft" />; }',
      },
      {
        expectedTerm: "reference ID",
        name: "description prop",
        source:
          'export function View() { return <Panel description="Reference IDs are hidden" />; }',
      },
      {
        expectedTerm: "draft",
        name: "generation disabled reason prop",
        source:
          'export function View() { return <StudioCommandBar generateDisabledReason="Publish draft before generating questions." />; }',
      },
      {
        expectedTerm: "server draft",
        name: "object reason copy",
        source: 'const view = { reason: "Server draft is unavailable." };',
      },
      {
        expectedTerm: "draft",
        name: "object generation disabled reason copy",
        source:
          'const view = { generateDisabledReason: "Publish draft before generating." };',
      },
      {
        expectedTerm: "reference ID",
        name: "object parse error copy",
        source:
          'const view = { parseError: "Reference ID could not be parsed." };',
      },
      {
        expectedTerm: "draft",
        name: "prefixed error setter",
        source:
          'function update() { setLocalDraftError("Saved draft could not be loaded."); }',
      },
      {
        expectedTerm: "revision",
        name: "save error setter",
        source: 'function update() { setSaveError("Revision conflict."); }',
      },
      {
        expectedTerm: "reference ID",
        name: "plural reference IDs",
        source: 'const label = "Reference IDs";',
      },
      {
        expectedTerm: "source binding",
        name: "plural source bindings",
        source: 'const label = "Source bindings";',
      },
      {
        expectedTerm: "source artifact",
        name: "plural source artifacts",
        source: 'const label = "Source artifacts";',
      },
      {
        expectedTerm: "workbook ID",
        name: "plural workbook IDs",
        source: 'const label = "Workbook IDs";',
      },
    ];

    for (const leakCase of leakCases) {
      expect(getBlockedTerms(leakCase.source), leakCase.name).toContain(
        leakCase.expectedTerm,
      );
    }
  });

  it("ignores route, API, and model internals that are not user-facing copy", () => {
    const blockedMatches = scanSourceForBlockedMatches({
      relativePath: "apps/web/src/features/questions/studio/internal.tsx",
      sourceText: `
        const draftId = "draft-1";
        const expectedRevision = 2;
        function View() {
          return (
            <>
              <Component kind={"draft"} />
              <Component mode={"draft"} />
              <Component routeSearch={{ draftId: "draft-1" }} />
            </>
          );
        }
        const input = {
          draftId: "draft-1",
          expectedRevision: 2,
          sourceId: "source-1",
        };
        type DraftState = { draftId: string };
      `,
    });

    expect(blockedMatches, formatBlockedMatches(blockedMatches)).toHaveLength(
      0,
    );
  });

  it("does not scan excluded tests or generated files", () => {
    expect(
      scanSourceForBlockedMatches({
        relativePath: "apps/web/src/features/questions/studio/example.test.tsx",
        sourceText: "export const label = 'Draft saved';",
      }),
    ).toHaveLength(0);
    expect(
      scanSourceForBlockedMatches({
        relativePath:
          "apps/web/src/features/questions/studio/generated/example.tsx",
        sourceText: "export const label = 'Draft saved';",
      }),
    ).toHaveLength(0);
    expect(
      scanSourceForBlockedMatches({
        relativePath:
          "apps/web/src/features/questions/studio/__generated__/example.tsx",
        sourceText: "export const label = 'Draft saved';",
      }),
    ).toHaveLength(0);
  });
});

function getScannedSources(): ScannedSource[] {
  return [
    ...toScannedSources(ROUTE_SOURCE_MODULES),
    ...toScannedSources(STUDIO_SOURCE_MODULES),
    ...toScannedSources(COMPOSED_EDITOR_SOURCE_MODULES),
  ]
    .filter((source) => isScannableSourcePath(source.relativePath))
    .sort((first, second) =>
      first.relativePath.localeCompare(second.relativePath),
    );
}

function getMissingIncludedPaths(sources: ScannedSource[]): string[] {
  return INCLUDED_PATHS.flatMap((entry) => {
    const hasSource = sources.some(
      (source) =>
        source.relativePath === entry.path ||
        source.relativePath.startsWith(`${entry.path}/`),
    );

    return hasSource ? [] : [entry.path];
  });
}

function toScannedSources(modules: Record<string, string>): ScannedSource[] {
  return Object.entries(modules).map(([globPath, sourceText]) => ({
    relativePath: toRepositoryRelativePath(globPath),
    sourceText,
  }));
}

function toRepositoryRelativePath(globPath: string): string {
  if (globPath === "../../../routes/_layout.studio.tsx") {
    return "apps/web/src/routes/_layout.studio.tsx";
  }
  if (globPath.startsWith("./")) {
    return `apps/web/src/features/questions/studio/${globPath.slice(2)}`;
  }
  if (globPath.startsWith("../composed-editor/")) {
    return `apps/web/src/features/questions/${globPath.slice(3)}`;
  }

  return globPath;
}

function scanSourceForBlockedMatches({
  relativePath,
  sourceText,
}: {
  relativePath: string;
  sourceText: string;
}): BlockedMatch[] {
  if (!isScannableSourcePath(relativePath)) {
    return [];
  }

  return extractUserFacingCopyFromSource({
    relativePath,
    sourceText,
  }).flatMap((item) => findBlockedMatches(item));
}

function getBlockedTerms(sourceText: string): string[] {
  return scanSourceForBlockedMatches({
    relativePath: "apps/web/src/features/questions/studio/example.tsx",
    sourceText,
  }).map((match) => match.term);
}

function isScannableSourcePath(relativePath: string): boolean {
  return (
    /\.(?:[cm]?ts|[cm]?tsx)$/u.test(relativePath) &&
    !shouldExcludePath(relativePath)
  );
}

function shouldExcludePath(relativePath: string): boolean {
  return EXCLUDED_PATHS.some((entry) => entry.pattern.test(relativePath));
}

function extractUserFacingCopyFromSource({
  relativePath,
  sourceText,
}: {
  relativePath: string;
  sourceText: string;
}): ScannedCopy[] {
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const copy: ScannedCopy[] = [];

  function visit(syntaxNode: ts.Node) {
    const text = getUserFacingText(syntaxNode);

    if (text && text.trim().length > 0) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        syntaxNode.getStart(sourceFile),
      );

      copy.push({
        column: position.character + 1,
        line: position.line + 1,
        relativePath,
        text: normalizeText(text),
      });
    }

    ts.forEachChild(syntaxNode, visit);
  }

  visit(sourceFile);
  return copy;
}

function getUserFacingText(syntaxNode: ts.Node): string | null {
  if (ts.isJsxText(syntaxNode)) {
    return syntaxNode.getText();
  }

  if (!isStringLikeNode(syntaxNode)) {
    return null;
  }

  if (
    isUserFacingJsxAttributeValue(syntaxNode) ||
    isRenderedJsxExpressionResult(syntaxNode) ||
    isCopyLikeInitializerValue(syntaxNode) ||
    isCopyLikeFunctionReturnValue(syntaxNode) ||
    isCopySetterArgument(syntaxNode)
  ) {
    return syntaxNode.text;
  }

  return null;
}

function isStringLikeNode(
  syntaxNode: ts.Node,
): syntaxNode is
  | ts.StringLiteral
  | ts.NoSubstitutionTemplateLiteral
  | ts.TemplateHead
  | ts.TemplateMiddle
  | ts.TemplateTail {
  return (
    ts.isStringLiteral(syntaxNode) ||
    ts.isNoSubstitutionTemplateLiteral(syntaxNode) ||
    syntaxNode.kind === ts.SyntaxKind.TemplateHead ||
    syntaxNode.kind === ts.SyntaxKind.TemplateMiddle ||
    syntaxNode.kind === ts.SyntaxKind.TemplateTail
  );
}

function isUserFacingJsxAttributeValue(syntaxNode: ts.Node): boolean {
  const attribute = findAncestor(syntaxNode, ts.isJsxAttribute);
  const attributeName = attribute ? getJsxAttributeName(attribute) : null;
  const valueRoot = attribute?.initializer
    ? getJsxAttributeValueRoot(attribute.initializer)
    : null;

  return Boolean(
    attribute &&
      attributeName &&
      isUserFacingJsxAttributeName(attributeName) &&
      valueRoot &&
      isResultValueOf(syntaxNode, valueRoot),
  );
}

function getJsxAttributeName(attribute: ts.JsxAttribute): string | null {
  return ts.isIdentifier(attribute.name) ? attribute.name.text : null;
}

function getJsxAttributeValueRoot(
  initializer: ts.JsxAttributeValue,
): ts.Node | null {
  if (ts.isJsxExpression(initializer)) {
    return initializer.expression ?? null;
  }

  return initializer;
}

function isUserFacingJsxAttributeName(attributeName: string): boolean {
  return (
    USER_FACING_JSX_ATTRIBUTES.has(attributeName) ||
    isCopyLikeIdentifierName(attributeName)
  );
}

function isRenderedJsxExpressionResult(syntaxNode: ts.Node): boolean {
  const jsxExpression = findAncestor(syntaxNode, ts.isJsxExpression);
  if (
    !jsxExpression?.expression ||
    !(
      ts.isJsxElement(jsxExpression.parent) ||
      ts.isJsxFragment(jsxExpression.parent)
    )
  ) {
    return false;
  }

  return isResultValueOf(syntaxNode, jsxExpression.expression);
}

function isCopyLikeInitializerValue(syntaxNode: ts.Node): boolean {
  const property = findAncestor(syntaxNode, ts.isPropertyAssignment);
  if (property && isCopyLikeName(property.name)) {
    return isResultValueOf(syntaxNode, property.initializer);
  }

  const variable = findAncestor(syntaxNode, ts.isVariableDeclaration);
  if (variable?.initializer && isCopyLikeName(variable.name)) {
    return isResultValueOf(syntaxNode, variable.initializer);
  }

  return false;
}

function isCopySetterArgument(syntaxNode: ts.Node): boolean {
  const call = findAncestor(syntaxNode, ts.isCallExpression);
  if (!call || !ts.isIdentifier(call.expression)) {
    return false;
  }

  return (
    COPY_SETTER_PATTERN.test(call.expression.text) &&
    call.arguments.some((argument) => isResultValueOf(syntaxNode, argument))
  );
}

function isCopyLikeFunctionReturnValue(syntaxNode: ts.Node): boolean {
  const returnStatement = findAncestor(syntaxNode, ts.isReturnStatement);
  if (!returnStatement?.expression) {
    return false;
  }

  const functionNode = findNearestFunctionLike(returnStatement);

  return Boolean(
    functionNode &&
      isCopyLikeFunctionName(functionNode) &&
      isResultValueOf(syntaxNode, returnStatement.expression),
  );
}

function isCopyLikeName(name: ts.Node): boolean {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return isCopyLikeIdentifierName(name.text);
  }

  return false;
}

function isCopyLikeIdentifierName(name: string): boolean {
  return COPY_PROPERTY_NAMES.has(name) || COPY_NAME_PATTERN.test(name);
}

function isCopyLikeFunctionName(functionNode: ts.Node): boolean {
  if (
    (ts.isFunctionDeclaration(functionNode) ||
      ts.isFunctionExpression(functionNode)) &&
    functionNode.name
  ) {
    return isCopyLikeName(functionNode.name);
  }

  if (
    ts.isArrowFunction(functionNode) &&
    ts.isVariableDeclaration(functionNode.parent)
  ) {
    return isCopyLikeName(functionNode.parent.name);
  }

  return false;
}

function findNearestFunctionLike(syntaxNode: ts.Node): ts.Node | null {
  let current = syntaxNode.parent;

  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current)
    ) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function isResultValueOf(syntaxNode: ts.Node, root: ts.Node): boolean {
  let current = getExpressionContainer(syntaxNode);

  while (current) {
    if (current === root) {
      return true;
    }

    const parent = current.parent;

    if (!parent) {
      return false;
    }

    if (ts.isParenthesizedExpression(parent) && parent.expression === current) {
      current = parent;
      continue;
    }

    if (ts.isAsExpression(parent) && parent.expression === current) {
      current = parent;
      continue;
    }

    if (ts.isSatisfiesExpression(parent) && parent.expression === current) {
      current = parent;
      continue;
    }

    if (
      ts.isConditionalExpression(parent) &&
      (parent.whenTrue === current || parent.whenFalse === current)
    ) {
      current = parent;
      continue;
    }

    if (
      ts.isBinaryExpression(parent) &&
      isCopyCombiningOperator(parent.operatorToken.kind) &&
      (parent.left === current || parent.right === current)
    ) {
      current = parent;
      continue;
    }

    return false;
  }

  return false;
}

function getExpressionContainer(syntaxNode: ts.Node): ts.Node | null {
  if (
    isTemplateChunk(syntaxNode) &&
    (ts.isTemplateExpression(syntaxNode.parent) ||
      ts.isNoSubstitutionTemplateLiteral(syntaxNode.parent))
  ) {
    return syntaxNode.parent;
  }

  return syntaxNode;
}

function isTemplateChunk(syntaxNode: ts.Node): boolean {
  return (
    syntaxNode.kind === ts.SyntaxKind.TemplateHead ||
    syntaxNode.kind === ts.SyntaxKind.TemplateMiddle ||
    syntaxNode.kind === ts.SyntaxKind.TemplateTail
  );
}

function isCopyCombiningOperator(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.PlusToken ||
    kind === ts.SyntaxKind.QuestionQuestionToken ||
    kind === ts.SyntaxKind.BarBarToken
  );
}

function findAncestor<T extends ts.Node>(
  syntaxNode: ts.Node,
  predicate: (ancestor: ts.Node) => ancestor is T,
): T | null {
  let current = syntaxNode.parent;

  while (current) {
    if (predicate(current)) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function findBlockedMatches(copy: ScannedCopy) {
  return FORBIDDEN_TERMS.flatMap((term) => {
    if (!term.pattern.test(copy.text) || isAllowedMatch(copy, term)) {
      return [];
    }

    return [{ ...copy, term: term.term }];
  });
}

function isAllowedMatch(copy: ScannedCopy, term: ForbiddenTerm): boolean {
  return ALLOWED_MATCHES.some(
    (allowed) =>
      allowed.relativePath === copy.relativePath &&
      allowed.term === term.term &&
      allowed.text === copy.text,
  );
}

function getAllowedMatchDocumentationIssues(): string[] {
  const forbiddenTerms = new Set(FORBIDDEN_TERMS.map((term) => term.term));

  return ALLOWED_MATCHES.flatMap((allowed, index) => {
    const issues = [];
    if (!allowed.relativePath.trim()) {
      issues.push(`ALLOWED_MATCHES[${index}] is missing relativePath.`);
    }
    if (!allowed.term.trim()) {
      issues.push(`ALLOWED_MATCHES[${index}] is missing term.`);
    }
    if (!allowed.text.trim()) {
      issues.push(`ALLOWED_MATCHES[${index}] is missing text.`);
    }
    if (!allowed.reason.trim()) {
      issues.push(`ALLOWED_MATCHES[${index}] is missing reason.`);
    }
    if (allowed.term.trim() && !forbiddenTerms.has(allowed.term)) {
      issues.push(
        `ALLOWED_MATCHES[${index}] term "${allowed.term}" is not in FORBIDDEN_TERMS.`,
      );
    }
    return issues;
  });
}

function formatBlockedMatches(matches: BlockedMatch[]): string {
  if (matches.length === 0) {
    return "No forbidden Studio UI terminology found.";
  }

  const details = matches
    .map(
      (match) =>
        `${match.relativePath}:${match.line}:${match.column} uses "${match.term}" in "${match.text}"`,
    )
    .join("\n");

  return [
    "Normal Studio UI copy must not expose implementation terminology.",
    "If this is truly intentional, add a narrow ALLOWED_MATCHES entry with a reason.",
    details,
  ].join("\n");
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
