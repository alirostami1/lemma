## Deployment TODOs

- Run worker on internal network only.
- Do not expose public ingress.
- Set container memory, CPU, and pids limits.
- Prefer read-only root filesystem with writable temp/workspace dirs.
- Configure `WORKBOOK_WORKER_SHARED_SECRET` outside local dev.
- Consider max requests before LibreOffice restart.
