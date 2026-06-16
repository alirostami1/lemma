import { getOidc } from "#/lib/oidc";

export async function signIn(): Promise<void> {
  const oidc = await getOidc();
  if (!oidc.isUserLoggedIn) {
    await oidc.login();
    return;
  }

  await oidc.goToAuthServer({ extraQueryParams: { prompt: "login" } });
}
