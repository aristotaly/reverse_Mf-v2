"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession } from "@/lib/session";

export async function loginAction(
  formData: FormData,
): Promise<{ error: string } | void> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return { error: "Invalid username or password." };
  }

  const valid = await bcrypt.compare(password, user.passcodeHash);
  if (!valid) {
    return { error: "Invalid username or password." };
  }

  await createSession(user.id);
  redirect("/weight-trend");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
