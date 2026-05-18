"use client";

import { useState, useTransition } from "react";
import { KeyRound, Shield, ShieldOff, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteUserAction,
  setUserPasswordAction,
  setUserRoleAction,
  type AdminUserSummary,
} from "@/lib/actions/admin";

type UserListProps = {
  users: AdminUserSummary[];
  currentUserId: string;
};

export function UserList({ users, currentUserId }: UserListProps) {
  const [resetTarget, setResetTarget] = useState<AdminUserSummary | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function clearError() {
    setGlobalError(null);
  }

  function handleToggleRole(user: AdminUserSummary) {
    clearError();
    const newRole = user.role === "admin" ? "user" : "admin";
    if (
      !confirm(
        `Change ${user.username}'s role from ${user.role} to ${newRole}?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setUserRoleAction(user.id, newRole);
      if (!result.ok) setGlobalError(result.error ?? "Failed to change role.");
    });
  }

  function handleDelete(user: AdminUserSummary) {
    clearError();
    if (
      !confirm(
        `Delete user ${user.username}? This will also delete all ${user.entryCount} weight entries. This cannot be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteUserAction(user.id);
      if (!result.ok) setGlobalError(result.error ?? "Failed to delete user.");
    });
  }

  return (
    <div className="space-y-3 px-4 py-2">
      {globalError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          data-testid="admin-error"
        >
          {globalError}
        </div>
      )}
      <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <li
              key={user.id}
              className="border-b border-neutral-100 px-4 py-3 last:border-0"
              data-testid={`user-row-${user.username}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className="truncate text-base font-semibold text-neutral-900"
                      data-testid={`user-username-${user.username}`}
                    >
                      {user.username}
                    </p>
                    <RolePill role={user.role} />
                    {isSelf && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-800">
                        You
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-neutral-500">
                    {user.name}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {user.entryCount}{" "}
                    {user.entryCount === 1 ? "entry" : "entries"} ·{" "}
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    onClick={() => setResetTarget(user)}
                    title="Reset password"
                    label={`Reset password for ${user.username}`}
                    testId={`reset-password-${user.username}`}
                    disabled={pending}
                  >
                    <KeyRound className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    onClick={() => handleToggleRole(user)}
                    title={
                      user.role === "admin" ? "Demote to user" : "Promote to admin"
                    }
                    label={
                      user.role === "admin"
                        ? `Demote ${user.username}`
                        : `Promote ${user.username}`
                    }
                    testId={`toggle-role-${user.username}`}
                    disabled={pending || isSelf}
                  >
                    {user.role === "admin" ? (
                      <ShieldOff className="h-4 w-4" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(user)}
                    title="Delete user"
                    label={`Delete ${user.username}`}
                    testId={`delete-user-${user.username}`}
                    disabled={pending || isSelf}
                    danger
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onError={setGlobalError}
      />
    </div>
  );
}

function RolePill({ role }: { role: "admin" | "user" }) {
  if (role === "admin") {
    return (
      <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        admin
      </span>
    );
  }
  return (
    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-700">
      user
    </span>
  );
}

type IconButtonProps = {
  onClick: () => void;
  title: string;
  label: string;
  testId: string;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
};

function IconButton({
  onClick,
  title,
  label,
  testId,
  disabled,
  danger,
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      data-testid={testId}
      className={
        "flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        (danger
          ? "text-red-600 hover:bg-red-50"
          : "text-neutral-700 hover:bg-neutral-100")
      }
    >
      {children}
    </button>
  );
}

type ResetPasswordDialogProps = {
  target: AdminUserSummary | null;
  onClose: () => void;
  onError: (msg: string | null) => void;
};

function ResetPasswordDialog({
  target,
  onClose,
  onError,
}: ResetPasswordDialogProps) {
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    if (!target) return;
    setLocalError(null);
    onError(null);
    const password = String(formData.get("password") ?? "");
    startTransition(async () => {
      const result = await setUserPasswordAction(target.id, password);
      if (!result.ok) {
        setLocalError(result.error ?? "Failed to reset password.");
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setLocalError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Reset password{target ? ` for ${target.username}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              name="password"
              type="password"
              required
              minLength={4}
              autoComplete="new-password"
              data-testid="reset-password-input"
            />
          </div>
          {localError && (
            <p className="text-sm text-red-600" data-testid="reset-password-error">
              {localError}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="w-full"
            data-testid="reset-password-submit"
          >
            {pending ? "Saving…" : "Save new password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
