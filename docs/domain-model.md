# Domain Model

## Core Terms

- Question blueprint: reusable authoring source for questions.
- Question set: collection of generated or curated questions.
- Question: playable question instance.
- Question generation run: asynchronous job that produces questions.
- Workbook: spreadsheet asset attached through a blueprint/package workflow.
- Workbook snapshot: captured workbook state.
- Workbook calculation: evaluated workbook values from an engine.
- File upload: storage lifecycle record for uploaded content.
- Identity user: application user mapped from Keycloak.
- Outbox event: durable event used by workers and integrations.

## Relationships

```mermaid
erDiagram
  USER ||--o{ QUESTION_BLUEPRINT : authors
  QUESTION_BLUEPRINT ||--o{ QUESTION_GENERATION_RUN : starts
  QUESTION_GENERATION_RUN ||--o{ QUESTION : produces
  QUESTION_SET ||--o{ QUESTION : contains
  QUESTION_BLUEPRINT ||--o| WORKBOOK : owns_current_source
  WORKBOOK ||--o{ WORKBOOK_SNAPSHOT : captures
  WORKBOOK_SNAPSHOT ||--o{ WORKBOOK_CALCULATION : evaluates
  FILE ||--o{ WORKBOOK : backs
```

## Bounded Contexts

- `@lemma/identity`: users, roles, auth-facing identity operations.
- `@lemma/files`: upload and object storage lifecycle.
- `@lemma/workbook`: workbook registration, snapshots, calculations.
- `@lemma/questions`: authoring, generation, grading, question sets.
- `@lemma/events`: transactional outbox.
- `@lemma/notifications`: realtime auth and notification channels.
- `@lemma/ops`: operational views and repair actions.
