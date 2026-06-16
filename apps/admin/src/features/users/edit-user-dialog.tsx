import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { Input } from "@lemma/ui/components/input";
import { useEffect, useState } from "react";
import type { IdentityUser } from "#/domains/identity";

export function EditUserDialog({
  user,
  open,
  isSaving,
  onOpenChange,
  onSave,
}: {
  user: IdentityUser | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange(open: boolean): void;
  onSave(displayName: string): void;
}) {
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="admin-user-name">
            Display name
          </label>
          <Input
            id="admin-user-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving || displayName.trim().length === 0}
            onClick={() => onSave(displayName.trim())}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
