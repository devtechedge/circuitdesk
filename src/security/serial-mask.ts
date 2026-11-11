export function maskSerialNumber(serial: string): string {
  const clean = serial.trim().toUpperCase();
  if (clean.length <= 4) return "****";
  if (clean.length <= 8) return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}

export function maskImei(imei: string | null | undefined): string | null {
  if (!imei) return null;
  const digits = imei.replace(/\D/g, "");
  if (digits.length < 8) return "********";
  return `${digits.slice(0, 2)}*********${digits.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return "***@***";
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  return `${trimmed.slice(0, Math.min(5, trimmed.length - 2))}***${trimmed.slice(-2)}`;
}
