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
  STUDIO_KEYBINDINGS,
  STUDIO_SHORTCUT_HELP_NOTES,
} from "./studio-keybindings";

export function StudioShortcutHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts work when a block is selected.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Action
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Shortcut
                  </th>
                </tr>
              </thead>
              <tbody>
                {STUDIO_KEYBINDINGS.map((binding) => (
                  <tr className="border-b last:border-b-0" key={binding.action}>
                    <td className="px-3 py-2">{binding.label}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {binding.keys.map((key) => (
                          <kbd
                            className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs"
                            key={key}
                          >
                            {key}
                          </kbd>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <h3 className="text-sm font-medium">While you work</h3>
            <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
              {STUDIO_SHORTCUT_HELP_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
