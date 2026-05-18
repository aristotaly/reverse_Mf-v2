"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters.")
  .max(32, "Username must be 32 characters or fewer.")
  .regex(
    /^[a-z0-9._-]+$/,
    "Username may only contain lowercase letters, digits, dots, dashes, and underscores.",
  );

const passwordSchema = z
  .string()
  .min(4, "Password must be at least 4 characters.")
  .max(128, "Password must be 128 characters or fewer.");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(80, "Name must be 80 characters or fewer.");

const roleSchema = z.enum(["admin", "user"]);

export type AdminUserSummary = {
  id: string;
  username: string;
  name: string;
  role: "admin" | "user";
  entryCount: number;
  createdAt: string;
};

export type AdminActionResult = {
  ok: boolean;
  error?: string;
};

/** Lists every user with their weight-entry count. Admin only. */
export async function listUsersAction(): Promise<AdminUserSummary[]> {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { weightEntries: true } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role === "admin" ? "admin" : "user",
    entryCount: u._count.weightEntries,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function createUserAction(
  formData: FormData,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Forbidden." };
  }

  const parsed = z
    .object({
      username: usernameSchema,
      name: nameSchema,
      password: passwordSchema,
      role: roleSchema,
    })
    .safeParse({
      username: formData.get("username"),
      name: formData.get("name"),
      password: formData.get("password"),
      role: formData.get("role") ?? "user",
    });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });
  if (existing) {
    return { ok: false, error: "Username is already taken." };
  }

  const passcodeHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.user.create({
    data: {
      username: parsed.data.username,
      name: parsed.data.name,
      role: parsed.data.role,
      passcodeHash,
    },
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUserAction(
  userId: string,
): Promise<AdminActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Forbidden." };
  }

  if (userId === admin.id) {
    return { ok: false, error: "You can't delete your own account." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found." };

  if (target.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return { ok: false, error: "Can't delete the last admin." };
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function setUserRoleAction(
  userId: string,
  role: "admin" | "user",
): Promise<AdminActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Forbidden." };
  }

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "Invalid role." };

  if (userId === admin.id && role !== "admin") {
    return { ok: false, error: "You can't demote yourself." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found." };

  if (target.role === "admin" && role === "user") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return { ok: false, error: "Can't demote the last admin." };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: parsed.data },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function setUserPasswordAction(
  userId: string,
  newPassword: string,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Forbidden." };
  }

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found." };

  const passcodeHash = await bcrypt.hash(parsed.data, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passcodeHash },
  });

  revalidatePath("/admin");
  return { ok: true };
}
