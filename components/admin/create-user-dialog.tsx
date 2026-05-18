"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUserAction } from "@/lib/actions/admin";

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createUserAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Failed to create user.");
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new user</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-username">Username</Label>
            <Input
              id="new-username"
              name="username"
              type="text"
              required
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9._\-]+"
              data-testid="new-username-input"
            />
            <p className="text-xs text-neutral-500">
              Lowercase, letters/digits/._-, 3–32 chars.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-name">Display name</Label>
            <Input
              id="new-name"
              name="name"
              type="text"
              required
              autoComplete="off"
              maxLength={80}
              data-testid="new-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              required
              minLength={4}
              autoComplete="new-password"
              data-testid="new-password-input"
            />
            <p className="text-xs text-neutral-500">Minimum 4 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-role">Role</Label>
            <select
              id="new-role"
              name="role"
              defaultValue="user"
              className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              data-testid="new-role-select"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-600" data-testid="create-user-error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="w-full"
            data-testid="create-user-submit"
          >
            {pending ? "Creating…" : "Create user"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
