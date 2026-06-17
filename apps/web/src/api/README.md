# API Boundary

Generated Orval output lives in `src/api/generated`. Treat generated files as
transport infrastructure, not application models.

The web generator consumes `webOpenapi` from `@lemma/api-contract`, not the full
API contract. Ops routes and identity administration routes must not be
generated into this app.

Generated imports are allowed inside the domain boundary that maps transport
types to app models:

- `src/domains/files/*`
- `src/domains/workbooks/*`
- `src/domains/questions/*`

Routes and features should use domain hooks/models instead of generated hooks/DTOs.

Generated Ops output and identity user/role administration are not part of the
web app surface; admin UI lives in `apps/admin`.

Domain boundaries should keep generated code contained in domain API,
hook, mapper, model, request-mapper, and Questions blueprint files.
`domains/questions/blueprint.ts` may import generated model types for canonical
question blueprint document mapping.

Shared API infrastructure, such as normalized error types, can live outside `generated`.
