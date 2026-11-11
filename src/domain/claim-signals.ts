import type { DuplicateSignal, FaultCategory, PolicySnapshot } from "@/db/schema";

export const FAULT_TAXONOMY_META: Record<
  FaultCategory,
  { label: string; benchCheck: string; typicalCause: string }
> = {
  DOA: {
    label: "Dead on Arrival (DOA)",
    benchCheck: "Zero-power rail check and sealed-box serial match within DOA window",
    typicalCause: "Factory SMT open-circuit or transit shock",
  },
  BATTERY: {
    label: "Battery & Runtime Degradation",
    benchCheck: "Constant-current discharge curve and cell internal impedance (mOhm)",
    typicalCause: "Cell voltage sag, BMS cut-off drift, or rogue cell lot",
  },
  CHARGING: {
    label: "Charging & Power Delivery",
    benchCheck: "USB-C PD negotiation probe, pogo-pin corrosion, and thermal check",
    typicalCause: "Port wear, controller MOSFET failure, or contact oxidation",
  },
  CONNECTIVITY: {
    label: "Bluetooth / Wi-Fi / Sensor Sync",
    benchCheck: "RF RSSI chamber check and pairing reset",
    typicalCause: "Antenna detuning or firmware pairing state corruption",
  },
  PHYSICAL_DAMAGE: {
    label: "Enclosure / Accidental Damage",
    benchCheck: "Visual housing, ingress indicator sticker, and drop impact inspection",
    typicalCause: "Customer drop, crush load, or liquid ingress (often excluded unless covered)",
  },
  MISSING_PARTS: {
    label: "Missing In-Box Accessory",
    benchCheck: "Pack-out weight log and batch packing QC check",
    typicalCause: "Fulfilment line omission",
  },
  SOFTWARE_FIRMWARE: {
    label: "Firmware / Bootloop / App Fault",
    benchCheck: "DFU re-flash and bootloader diagnostic log",
    typicalCause: "Interrupted OTA update",
  },
};

export function evaluateClaimSignals(params: {
  policySnapshot: PolicySnapshot;
  openClaimsOnSameSerial: number;
  priorResolvedClaimsOnSameSerial: number;
  recentClaimsFromSameEmail30d: number;
  registrationStatus?: string | null;
}): DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];

  if (params.openClaimsOnSameSerial > 0) {
    signals.push({
      code: "DUPLICATE_ACTIVE_CLAIM",
      severity: "HIGH",
      detail: `Serial already has ${params.openClaimsOnSameSerial} open claim(s) in queue.`,
    });
  }

  if (params.priorResolvedClaimsOnSameSerial > 0) {
    signals.push({
      code: "PRIOR_SERIAL_CLAIM",
      severity: "MEDIUM",
      detail: `Serial has ${params.priorResolvedClaimsOnSameSerial} prior resolved claim(s); inspect for repeat fault.`,
    });
  }

  if (!params.policySnapshot.withinCoverageWindow) {
    signals.push({
      code: "OUT_OF_COVERAGE_WINDOW",
      severity: "HIGH",
      detail: "Purchase date falls outside the standard policy coverage window; human review required.",
    });
  }

  if (!params.policySnapshot.faultCoveredByPolicy) {
    signals.push({
      code: "UNCOVERED_FAULT_CATEGORY",
      severity: "MEDIUM",
      detail: "Selected fault category is outside standard covered faults; inspect receipt and photos before deciding.",
    });
  }

  if (params.registrationStatus === "PENDING_REVIEW") {
    signals.push({
      code: "PENDING_OFFLINE_REGISTRATION",
      severity: "MEDIUM",
      detail: "Offline/dealer registration receipt is still awaiting operator verification.",
    });
  }

  if (params.recentClaimsFromSameEmail30d >= 3) {
    signals.push({
      code: "RAPID_CONTACT_VELOCITY",
      severity: "MEDIUM",
      detail: `Contact email submitted ${params.recentClaimsFromSameEmail30d} claims in the past 30 days.`,
    });
  }

  return signals;
}
