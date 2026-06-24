import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { useEffect, useMemo, useState } from "react";
import type { IdentityUser, Role, UserRole } from "#/domains/identity";
import { daysFromNow } from "#/features/shared";

export function GrantRoleDialog({
  user,
  roles,
  userRoles,
  open,
  rolesLoading,
  isSaving,
  onOpenChange,
  onGrant,
}: {
  user: IdentityUser | null;
  roles: Role[];
  userRoles: UserRole[];
  open: boolean;
  rolesLoading: boolean;
  isSaving: boolean;
  onOpenChange(open: boolean): void;
  onGrant(roleKey: string, expiresAt: string): void;
}) {
  const grantedRoleIds = useMemo(
    () => new Set(userRoles.map((role) => role.roleId)),
    [userRoles],
  );
  const grantableRoles = useMemo(
    () => roles.filter((role) => !grantedRoleIds.has(role.id)),
    [grantedRoleIds, roles],
  );
  const [roleKey, setRoleKey] = useState("");
  const [duration, setDuration] = useState("365");

  useEffect(() => {
    setRoleKey(grantableRoles[0]?.key ?? "");
  }, [grantableRoles]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant role</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="admin-role-key">
              Role
            </label>
            {rolesLoading ? (
              <Skeleton className="h-9" />
            ) : grantableRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No ungranted roles available.
              </p>
            ) : (
              <Select onValueChange={setRoleKey} value={roleKey}>
                <SelectTrigger className="w-full" id="admin-role-key">
                  <SelectValue placeholder="Choose role" />
                </SelectTrigger>
                <SelectContent>
                  {grantableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.key}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="admin-role-expiry">
              Duration
            </label>
            <Select onValueChange={setDuration} value={duration}>
              <SelectTrigger className="w-full" id="admin-role-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isSaving || rolesLoading || !roleKey}
            onClick={() =>
              onGrant(roleKey, daysFromNow(Number.parseInt(duration, 10)))
            }
            type="button"
          >
            Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
