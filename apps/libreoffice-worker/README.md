# LibreOffice worker app

Containerized workbook calculation service backed by LibreOffice.

## Uses

- `@lemma/workbook-engine` for workbook inspection and calculation behavior
- Docker runtime dependencies for LibreOffice

## Commands

This app is primarily built as a container:

```bash
podman build -f apps/libreoffice-worker/Dockerfile -t localhost/lemma-libreoffice-worker:local .
```

## Notes

Keep the HTTP surface small. Workbook domain behavior should stay in
`@lemma/workbook-engine` or `@lemma/workbook`.

Deployment notes:

- keep the worker on an application network, not public ingress
- set memory, CPU, and pids limits for server deployments
- prefer a read-only root filesystem with writable temp/workspace directories
- configure any shared secret outside local development
- consider worker restart limits if LibreOffice process stability becomes an issue
