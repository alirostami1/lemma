# Operations

This page is the operations index. Keep operational details in the focused docs
below.

- Local infrastructure: [infra.md](infra.md)
- Generated files and regeneration: [generated-files.md](generated-files.md)
- Validation and test commands: [testing.md](testing.md)
- Deployment concepts: [deployment.md](deployment.md)
- Authentication setup: [auth.md](auth.md)

## Production Notes

- Keep backups off the application host.
- Treat migrations as deployment work, not just schema edits.
- Keep runtime secrets in environment-specific secret stores or server-side env
  files, not in Git.
