import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { LogIn, LogOut, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { env } from "#/env";
import { AdminConsole } from "#/features/admin-console";
import { useOidc } from "#/lib/oidc";

export function App() {
  const oidc = useOidc();

  if (!oidc.isUserLoggedIn) {
    if (oidc.initializationError) {
      return (
        <AdminFrame>
          <AccessCard
            title="Authentication unavailable"
            description={getAuthenticationUnavailableMessage(
              oidc.initializationError,
            )}
            action={
              <Button type="button" onClick={() => window.location.reload()}>
                <RefreshCw />
                Retry
              </Button>
            }
          />
        </AdminFrame>
      );
    }

    return (
      <AdminFrame>
        <AccessCard
          title="Sign in required"
          description="Sign in with an admin account to continue."
          action={
            <Button
              type="button"
              onClick={() =>
                void oidc.login({ redirectUrl: env.LEMMA_ADMIN_APP_URL })
              }
            >
              <LogIn />
              Sign in
            </Button>
          }
        />
      </AdminFrame>
    );
  }

  return (
    <AdminFrame
      accountName={
        oidc.decodedIdToken.email ??
        oidc.decodedIdToken.preferred_username ??
        oidc.decodedIdToken.name ??
        oidc.decodedIdToken.sub
      }
      onSignOut={() => oidc.logout({ redirectTo: "home" })}
    >
      <AdminConsole />
    </AdminFrame>
  );
}

function getAuthenticationUnavailableMessage(error: Error & {
  isAuthServerLikelyDown?: boolean;
}) {
  if (error.isAuthServerLikelyDown) {
    return "The identity provider could not be reached. Check Keycloak and retry.";
  }
  return error.message;
}

function AdminFrame({
  accountName,
  onSignOut,
  children,
}: {
  accountName?: string;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <div className="grid">
            <span className="font-semibold">{env.LEMMA_ADMIN_APP_TITLE}</span>
            <span className="text-xs text-muted-foreground">Admin console</span>
          </div>
          {accountName ? (
            <div className="flex items-center gap-3">
              <span className="max-w-64 truncate text-sm text-muted-foreground">
                {accountName}
              </span>
              <Button type="button" variant="outline" onClick={onSignOut}>
                <LogOut />
                Sign out
              </Button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="p-5">{children}</main>
    </div>
  );
}

function AccessCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[65dvh] w-full max-w-xl items-center px-5 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter>{action}</CardFooter>
      </Card>
    </div>
  );
}
