import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import {
  buildDailySeries,
  normalizeDate,
  toDateKey,
} from "../utils/analytics";
import { TEST_TODAY } from "../prisma/seed-test";

function runSeed(mode: "default" | "ewma" | "gap") {
  execSync(`npx tsx prisma/seed-test.ts ${mode}`, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    },
  });
}

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByTestId("username-input").fill("admin");
  await page.getByTestId("password-input").fill("1234");
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/weight-trend");
}

test.describe("Weight Tracker", () => {
  test.beforeEach(async () => {
    runSeed("default");
  });

  test("smoke: login and add scale weight entry", async ({ page }) => {
    await login(page);
    await page.goto("/scale-weight");
    await page.getByTestId("add-entry-button").click();
    await page.getByTestId("weight-input").fill("93.5");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByTestId("date-input").fill(today);
    await page.getByTestId("save-entry").click();
    await expect(page.getByText("93.5 kg")).toBeVisible();
  });

  test("EWMA math with out-of-order entries", async ({ page }) => {
    runSeed("ewma");
    await login(page);
    await page.goto("/weight-trend");

    const entries = [
      {
        date: normalizeDate(new Date("2026-05-08T00:00:00.000Z")),
        weight: 100,
      },
      {
        date: normalizeDate(new Date("2026-05-13T00:00:00.000Z")),
        weight: 90,
      },
      { date: TEST_TODAY, weight: 95 },
    ];
    const points = buildDailySeries(entries, TEST_TODAY);

    for (const point of points) {
      const key = toDateKey(point.date);
      const cell = page.getByTestId(`trend-${key}`);
      if (await cell.count()) {
        await expect(cell).toHaveText(point.trendRounded.toFixed(1));
      }
    }

    const todayKey = toDateKey(TEST_TODAY);
    const todayTrend = points.find((p) => toDateKey(p.date) === todayKey);
    expect(todayTrend).toBeDefined();
    await expect(page.getByTestId(`trend-${todayKey}`)).toHaveText(
      todayTrend!.trendRounded.toFixed(1),
    );
  });

  test("missing-day interpolation renders continuous chart points", async ({
    page,
  }) => {
    runSeed("gap");
    await login(page);
    await page.goto("/weight-trend");
    await page.getByTestId("filter-All").click();
    const points = await page.getByTestId("chart-point").count();
    expect(points).toBeGreaterThan(3);
  });

  test("UI filter state updates without errors", async ({ page }) => {
    await login(page);
    await page.goto("/weight-trend");

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.getByTestId("filter-1W").click();
    await expect(page.getByTestId("weight-chart")).toBeVisible();
    await expect(page.getByTestId("kpi-date-range")).not.toHaveText("");

    await page.getByTestId("filter-3M").click();
    await expect(page.getByTestId("weight-chart")).toBeVisible();

    await page.getByTestId("filter-All").click();
    await expect(page.getByTestId("weight-chart")).toBeVisible();

    const critical = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("404"),
    );
    expect(critical).toEqual([]);
  });
});
