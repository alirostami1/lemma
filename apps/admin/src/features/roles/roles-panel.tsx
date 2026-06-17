import { Badge } from "@lemma/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { InlineError } from "@lemma/ui/components/inline-error";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lemma/ui/components/table";
import type { Role } from "#/domains/identity";
import { TableSkeleton } from "#/features/shared";

export function RolesPanel({
  roles,
  isLoading,
  errorMessage,
  onRetry,
}: {
  roles: Role[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry(): void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <CardDescription>
          System role catalogue used by authorization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <TableSkeleton rows={4} /> : null}
        {errorMessage ? (
          <InlineError message={errorMessage} onRetry={onRetry} />
        ) : null}
        {!isLoading && !errorMessage ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{role.key}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.isSystem ? "secondary" : "outline"}>
                      {role.isSystem ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xl whitespace-normal">
                    {role.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
