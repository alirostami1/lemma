import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: ReactNode;
  description?: ReactNode;
  message?: ReactNode;
  children: ReactNode;
};

export function AuthLayout(props: AuthLayoutProps) {
  const { title, description, message, children } = props;

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="hidden border-r bg-muted/40 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-3">
          <div className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Lemma
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight">
            Question generation workspace
          </h1>
          <p className="max-w-lg text-base text-muted-foreground">
            Sign in to author generators, connect workbooks, and produce
            reusable question sets.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Secure access powered by Keycloak.
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-[420px] rounded-lg" size="sm">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {message ? (
              <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div>{message}</div>
              </div>
            ) : null}
            {children}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
