# Lemma Keycloak Theme

This app builds the Lemma login theme for Keycloak with Keycloakify. It follows
the Keycloakify shadcn/Tailwind starter approach, but imports shared components
and design tokens from `@lemma/ui`.

## Uses

- Keycloakify for Keycloak theme generation
- Vite for preview/build
- `@lemma/ui` for shared UI primitives

## Local preview

```bash
pnpm --filter keycloak-theme storybook
```

For quick Vite rendering without a Keycloak context:

```bash
pnpm --filter keycloak-theme dev
```

## Build

Build the deployable Keycloak theme JAR:

```bash
pnpm --filter keycloak-theme build-keycloak-theme
```

The output JAR is generated under `apps/keycloak-theme/dist_keycloak/`.

## Local Keycloak

The dev compose file mounts `apps/keycloak-theme/dist_keycloak` into
Keycloak's providers directory. Rebuild the theme, then restart Keycloak so it
loads the new provider JAR.

Select the `lemma` login theme in the realm settings.

## Production image

Build the Keycloak image with the Lemma theme baked in:

```bash
podman build -f apps/keycloak-theme/Dockerfile -t localhost/lemma-keycloak:local .
```

The image copies `lemma-keycloak-theme.jar` into `/opt/keycloak/providers/` and
runs `kc.sh build`, so production can start Keycloak with:

```bash
start --optimized
```

For Compose, use `infra/compose-keycloak.prod.yml` when you want the production
image path instead of the local bind-mounted theme JAR path.

## Generated Files

See [Generated Files](../../docs/generated-files.md) for ownership and
regeneration commands.
