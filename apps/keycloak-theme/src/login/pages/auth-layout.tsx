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
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground sm:p-6">
      <section className="w-full max-w-[420px]">
        <Card className="rounded-lg" size="sm">
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
