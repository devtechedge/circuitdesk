export type SlaState = "MET" | "ON_TRACK" | "AT_RISK" | "BREACHED";

export function computeClaimSlaDeadlines(params: {
  createdAt: Date;
  priority: "NORMAL" | "HIGH" | "URGENT";
  withinDoaWindow: boolean;
}): {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
} {
  const responseHours =
    params.priority === "URGENT" ? 8 : params.priority === "HIGH" ? 16 : 24;
  const resolutionHours = params.withinDoaWindow
    ? 72
    : params.priority === "HIGH"
      ? 120
      : 168;

  return {
    firstResponseDueAt: new Date(params.createdAt.getTime() + responseHours * 3600 * 1000),
    resolutionDueAt: new Date(params.createdAt.getTime() + resolutionHours * 3600 * 1000),
  };
}

export function evaluateSlaWindow(params: {
  startedAt: Date;
  dueAt: Date;
  completedAt?: Date | null;
  now?: Date;
}): {
  state: SlaState;
  remainingHours: number;
  elapsedRatio: number;
} {
  const totalMs = Math.max(params.dueAt.getTime() - params.startedAt.getTime(), 1);
  if (params.completedAt) {
    const met = params.completedAt.getTime() <= params.dueAt.getTime();
    return {
      state: met ? "MET" : "BREACHED",
      remainingHours: Math.round(
        (params.dueAt.getTime() - params.completedAt.getTime()) / (3600 * 1000)
      ),
      elapsedRatio: (params.completedAt.getTime() - params.startedAt.getTime()) / totalMs,
    };
  }

  const now = params.now ?? new Date();
  const elapsedMs = now.getTime() - params.startedAt.getTime();
  const ratio = elapsedMs / totalMs;
  const remainingHours = Math.round((params.dueAt.getTime() - now.getTime()) / (3600 * 1000));

  if (now.getTime() > params.dueAt.getTime()) {
    return { state: "BREACHED", remainingHours, elapsedRatio: ratio };
  }
  if (ratio >= 0.75) {
    return { state: "AT_RISK", remainingHours, elapsedRatio: ratio };
  }
  return { state: "ON_TRACK", remainingHours, elapsedRatio: ratio };
}
