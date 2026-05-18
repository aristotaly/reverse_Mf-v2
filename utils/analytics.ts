export type TimeWindow = "1W" | "1M" | "3M" | "6M" | "1Y" | "All";

export type WeightEntryInput = {
  date: Date;
  weight: number;
};

export type DailyPoint = {
  date: Date;
  scale: number;
  scaleIsInterpolated: boolean;
  trend: number;
  trendRounded: number;
  trendDelta: number;
};

export const EWMA_ALPHA = 0.1;

export function normalizeDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function toDateKey(date: Date): string {
  const d = normalizeDate(date);
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = normalizeDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysBetween(start: Date, end: Date): number {
  const ms = normalizeDate(end).getTime() - normalizeDate(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function buildDailySeries(
  entries: WeightEntryInput[],
  today: Date = new Date(),
): DailyPoint[] {
  if (entries.length === 0) return [];

  const sorted = [...entries]
    .map((e) => ({ date: normalizeDate(e.date), weight: e.weight }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const loggedByDay = new Map<string, number>();
  for (const entry of sorted) {
    loggedByDay.set(toDateKey(entry.date), entry.weight);
  }

  const start = sorted[0].date;
  const end = normalizeDate(today);
  const totalDays = daysBetween(start, end);
  const dailyScales: { date: Date; scale: number; interpolated: boolean }[] =
    [];

  for (let i = 0; i <= totalDays; i++) {
    const date = addDays(start, i);
    const key = toDateKey(date);
    if (loggedByDay.has(key)) {
      dailyScales.push({
        date,
        scale: loggedByDay.get(key)!,
        interpolated: false,
      });
      continue;
    }

    const prevLogged = sorted.filter((e) => e.date.getTime() < date.getTime());
    const nextLogged = sorted.filter((e) => e.date.getTime() > date.getTime());

    let scale: number;
    if (prevLogged.length === 0 && nextLogged.length > 0) {
      scale = nextLogged[0].weight;
    } else if (nextLogged.length === 0 && prevLogged.length > 0) {
      scale = prevLogged[prevLogged.length - 1].weight;
    } else if (prevLogged.length > 0 && nextLogged.length > 0) {
      const before = prevLogged[prevLogged.length - 1];
      const after = nextLogged[0];
      const span = daysBetween(before.date, after.date);
      const offset = daysBetween(before.date, date);
      const ratio = span === 0 ? 0 : offset / span;
      scale = before.weight + (after.weight - before.weight) * ratio;
    } else {
      scale = sorted[0].weight;
    }

    dailyScales.push({ date, scale, interpolated: true });
  }

  const points: DailyPoint[] = [];
  let prevTrend = 0;

  for (let i = 0; i < dailyScales.length; i++) {
    const { date, scale, interpolated } = dailyScales[i];
    const trend =
      i === 0 ? scale : EWMA_ALPHA * scale + (1 - EWMA_ALPHA) * prevTrend;
    const trendDelta = i === 0 ? 0 : trend - prevTrend;
    points.push({
      date,
      scale,
      scaleIsInterpolated: interpolated,
      trend,
      trendRounded: Math.round(trend * 10) / 10,
      trendDelta,
    });
    prevTrend = trend;
  }

  return points;
}

export function sliceByWindow(
  points: DailyPoint[],
  window: TimeWindow,
  today: Date = new Date(),
): DailyPoint[] {
  if (points.length === 0) return [];
  const end = normalizeDate(today);

  if (window === "All") return points.filter((p) => p.date <= end);

  const daysMap: Record<Exclude<TimeWindow, "All">, number> = {
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
  };

  const start = addDays(end, -daysMap[window] + 1);
  return points.filter((p) => p.date >= start && p.date <= end);
}

export function computeKpis(
  allPoints: DailyPoint[],
  _loggedEntries: WeightEntryInput[],
  window: TimeWindow,
  today: Date = new Date(),
) {
  const windowPoints = sliceByWindow(allPoints, window, today);
  const end = normalizeDate(today);
  const start =
    windowPoints[0]?.date ??
    (window === "All" ? allPoints[0]?.date : addDays(end, -30));

  // Average over the continuous daily TREND series in the window.
  // This matches MacroFactor's "Average" KPI (averaging only logged scale
  // weights would skew the mean during logging gaps).
  const average =
    windowPoints.length > 0
      ? windowPoints.reduce((sum, p) => sum + p.trend, 0) / windowPoints.length
      : 0;

  // Compute the "Difference" from the *rounded* (display-precision) trend
  // values at each endpoint, then re-round to clean up float artifacts.
  // MacroFactor uses the rounded display values for this calc, so any sub-0.05
  // residual at either endpoint gets quantized before the subtraction. Doing
  // raw - raw then rounding yields off-by-0.1 numbers (e.g. 6M -3.7 vs -3.8).
  const firstTrend = windowPoints[0]?.trend ?? 0;
  const lastTrend = windowPoints[windowPoints.length - 1]?.trend ?? 0;
  const firstTrendRounded = Math.round(firstTrend * 10) / 10;
  const lastTrendRounded = Math.round(lastTrend * 10) / 10;
  const difference = lastTrendRounded - firstTrendRounded;

  return {
    average: Math.round(average * 10) / 10,
    difference: Math.round(difference * 10) / 10,
    dateRangeLabel: formatDateRange(
      windowPoints[0]?.date ?? start,
      windowPoints[windowPoints.length - 1]?.date ?? end,
    ),
    windowPoints,
  };
}

export function formatDateRange(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}, ${yearFmt.format(end)}`;
}

export function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function getChartDomain(points: DailyPoint[]): {
  min: number;
  max: number;
  ticks: number[];
} {
  if (points.length === 0) {
    return { min: 90, max: 100, ticks: [90, 92, 94, 96, 98, 100] };
  }

  const values = points.flatMap((p) => [p.scale, p.trend]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const min = Math.floor((minVal - 1) / 2) * 2;
  const max = Math.ceil((maxVal + 1) / 2) * 2;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += 2) {
    ticks.push(t);
  }
  return { min, max, ticks };
}

export function formatTrendDelta(delta: number): string {
  if (Math.abs(delta) < 0.005) return "No Change";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
}
