# Lemma Keycloak Theme

This app builds the Lemma login theme for Keycloak with Keycloakify. It follows
the Keycloakify shadcn/Tailwind starter approach, but imports shared components
and design tokens from `@lemma/ui`.

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
