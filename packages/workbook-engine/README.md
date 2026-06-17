# @lemma/workbook-engine

Workbook inspection, value extraction, and calculation helpers for untrusted
user-uploaded spreadsheets.

## Main Surface

- workbook inspection
- cached spreadsheet value extraction after inspection
- LibreOffice client/runtime integration

## Security Model

The package treats `.xlsx` files as untrusted input.

Inspection is split into reviewable boundaries:

- `container/`: bounded ZIP container parsing and entry reads
- `security/`: forbidden workbook feature policy
- `inspection`: package-level workbook validation and resource checks
- `values`: cached value extraction, normalized sparse values, type metadata,
  and reference helpers
- `libreoffice-client`: worker boundary, timeouts, response limits, and typed
  failures

The ZIP boundary rejects duplicate entries, unsafe paths, unsupported
compression methods, excessive entry counts, excessive expanded bytes, large
entries, and high compression ratios before XML inspection or value extraction.

The security policy rejects macros, external workbook links, data connections,
OLE/ActiveX embeddings, encrypted packages, protected workbook/sheet features,
and external relationships. Runtime engines inspect before cached value reads
and before recalculation.

Cached values and LibreOffice responses pass through the same sparse-value
normalizer. It enforces sheet count, cell count, and cached value byte budgets,
and records per-cell type metadata where available. LibreOffice worker failures
are classified as invalid workbook, workbook too large, timeout, response too
large, calculation failed, unavailable, or invalid response.

## Used By

- `@lemma/workbook`
- LibreOffice worker app

## Commands

```bash
pnpm --filter @lemma/workbook-engine build
pnpm --filter @lemma/workbook-engine test
pnpm --filter @lemma/workbook-engine lint
```
