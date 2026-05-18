"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import type { AdminUserSummary } from "@/lib/actions/admin";
import { CreateUserDialog } from "./create-user-dialog";
import { UserList } from "./user-list";

type AdminShellProps = {
  currentUserId: string;
  users: AdminUserSummary[];
};

export function AdminShell({ currentUserId, users }: AdminShellProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader
        title="Users"
        backHref="/weight-trend"
        rightAction={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex h-9 w-9 items-center justify-center text-neutral-900"
            aria-label="Add user"
            data-testid="add-user-button"
          >
            <UserPlus className="h-5 w-5" strokeWidth={1.5} />
          </button>
        }
      />

      <div className="px-4 pt-3 pb-2 text-sm text-neutral-500">
        {users.length} {users.length === 1 ? "user" : "users"} ·{" "}
        {users.filter((u) => u.role === "admin").length} admin
        {users.filter((u) => u.role === "admin").length === 1 ? "" : "s"}
      </div>

      <UserList users={users} currentUserId={currentUserId} />

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
