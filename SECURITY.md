# Security

## Handling Sensitive Issues

Do not put sensitive exploit details, credentials, logs, or customer data in
ordinary issues. Use a restricted channel and include:

- affected component
- reproduction steps
- impact
- suggested fix, if known

Create a tracked engineering issue only after sensitive details are removed.

## Supported Branch

Use `main` as the supported branch.

## Secrets

Never commit real secrets. Use local `.env` files, GitHub Actions secrets, or
server-side environment files.
