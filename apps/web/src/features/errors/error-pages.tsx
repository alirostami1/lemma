import { Alert, AlertDescription } from "@lemma/ui/components/alert";
import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { Link } from "@tanstack/react-router";

const homeLinkActiveOptions = { exact: true };

type ErrorPageProps = {
  title: string;
  description: string;
  requestId?: string | null;
  action?: React.ReactNode;
};

function ErrorPage({ title, description, requestId, action }: ErrorPageProps) {
  return (
    <div className="mx-auto flex min-h-[65dvh] w-full max-w-xl items-center px-5 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {requestId ? (
          <CardContent>
            <Alert>
              <AlertDescription>Request ID: {requestId}</AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
        <CardFooter className="gap-2">{action}</CardFooter>
      </Card>
    </div>
  );
}

export function SignInRequiredPage({
  title = "Sign in required",
  description = "Sign in to continue.",
  onSignIn,
}: {
  title?: string;
  description?: string;
  onSignIn?: () => void;
}) {
  return (
    <ErrorPage
      action={
        onSignIn ? (
          <Button onClick={onSignIn} type="button">
            Sign in
          </Button>
        ) : (
          <Button asChild>
            <Link activeOptions={homeLinkActiveOptions} to="/">
              Go home
            </Link>
          </Button>
        )
      }
      description={description}
      title={title}
    />
  );
}

export function AccessDeniedPage({
  title = "Access denied",
  description = "You do not have access to this resource.",
  requestId,
}: {
  title?: string;
  description?: string;
  requestId?: string | null;
}) {
  return (
    <ErrorPage
      action={
        <Button asChild>
          <Link activeOptions={homeLinkActiveOptions} to="/">
            Go home
          </Link>
        </Button>
      }
      description={description}
      requestId={requestId}
      title={title}
    />
  );
}

export function NotFoundPage({
  title = "Not found",
  description = "The requested item could not be found.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <ErrorPage
      action={
        <Button asChild>
          <Link activeOptions={homeLinkActiveOptions} to="/">
            Go home
          </Link>
        </Button>
      }
      description={description}
      title={title}
    />
  );
}

export function UnexpectedErrorPage({
  title = "Something went wrong",
  description = "The page could not be loaded.",
  requestId,
  reset,
}: {
  title?: string;
  description?: string;
  requestId?: string | null;
  reset?: () => void;
}) {
  return (
    <ErrorPage
      action={
        reset ? (
          <Button onClick={reset} type="button">
            Try again
          </Button>
        ) : (
          <Button asChild>
            <Link activeOptions={homeLinkActiveOptions} to="/">
              Go home
            </Link>
          </Button>
        )
      }
      description={description}
      requestId={requestId}
      title={title}
    />
  );
}
