"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { InstallPrompt } from "@/components/install-prompt";
import type { DailyPoint } from "@/utils/analytics";
import { DashboardClient } from "./dashboard-client";
import { TutorialBanner } from "./tutorial-banner";

type WeightTrendShellProps = {
  allPoints: DailyPoint[];
  loggedEntries: { date: Date; weight: number }[];
  fixedDate?: Date;
  currentUser?: { username: string; name: string; role: "admin" | "user" };
};

export function WeightTrendShell({
  allPoints,
  loggedEntries,
  fixedDate,
  currentUser,
}: WeightTrendShellProps) {
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader
        title="Weight Trend"
        backHref="/"
        showTutorialIcon
        onTutorialClick={() => setShowTutorial(true)}
      />
      <InstallPrompt />
      <DashboardClient
        allPoints={allPoints}
        loggedEntries={loggedEntries}
        fixedDate={fixedDate}
      />
      {showTutorial && (
        <TutorialBanner
          forceShow
          onDismiss={() => setShowTutorial(false)}
        />
      )}
      <nav className="flex flex-wrap justify-center gap-4 px-4 pb-6 text-sm">
        <Link href="/scale-weight" className="text-violet-700 underline">
          Scale Weight
        </Link>
        <Link href="/weight-trend/logs" className="text-violet-700 underline">
          Trend Logs
        </Link>
        {currentUser?.role === "admin" && (
          <Link
            href="/admin"
            className="text-violet-700 underline"
            data-testid="admin-link"
          >
            Manage users
          </Link>
        )}
        <Link
          href="/logout"
          className="text-neutral-500 underline"
          data-testid="logout-link"
        >
          {currentUser ? `Sign out (${currentUser.username})` : "Sign out"}
        </Link>
      </nav>
    </div>
  );
}
