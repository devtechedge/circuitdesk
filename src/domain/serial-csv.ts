import { SALES_CHANNELS, type SalesChannel } from "@/db/schema";

export const SERIAL_CSV_TEMPLATE = [
  "sku,serial_number,imei,batch_code,sales_channel,external_order_id,sold_at",
  "KNX-ANC-PRO2,KNX-P2-2611-9001,,BATCH-KNX-2026-Q3A,D2C_WEB,SHP-IN-12001,2026-11-01",
  "KNX-WATCH-S1,KNX-W1-2611-5001,359881094408812,BATCH-KNX-2026-W1,MARKETPLACE,AMZ-404-910022,2026-11-02",
].join("\n");

export interface ParsedSerialCsvRow {
  rowNumber: number;
  sku: string;
  serialNumber: string;
  imei: string | null;
  batchCode: string | null;
  salesChannel: SalesChannel;
  externalOrderId: string | null;
  soldAt: Date | null;
}

export interface SerialCsvRowError {
  rowNumber: number;
  serialNumber: string;
  reason: string;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function hasFormulaPrefix(value: string): boolean {
  return /^[=+\-@]/.test(value);
}

export function previewSerialCsvImport(params: {
  csvText: string;
  knownSkus: ReadonlySet<string>;
  existingSerials: ReadonlySet<string>;
}): {
  totalRows: number;
  validRows: ParsedSerialCsvRow[];
  errors: SerialCsvRowError[];
} {
  const lines = params.csvText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return {
      totalRows: 0,
      validRows: [],
      errors: [{ rowNumber: 1, serialNumber: "-", reason: "CSV requires a header row and at least one data row." }],
    };
  }

  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const idxSku = headers.indexOf("sku");
  const idxSerial = headers.indexOf("serial_number");
  const idxImei = headers.indexOf("imei");
  const idxBatch = headers.indexOf("batch_code");
  const idxChannel = headers.indexOf("sales_channel");
  const idxOrder = headers.indexOf("external_order_id");
  const idxSoldAt = headers.indexOf("sold_at");

  if (idxSku === -1 || idxSerial === -1) {
    return {
      totalRows: lines.length - 1,
      validRows: [],
      errors: [
        {
          rowNumber: 1,
          serialNumber: "-",
          reason: "Missing required header columns: sku and serial_number.",
        },
      ],
    };
  }

  const validRows: ParsedSerialCsvRow[] = [];
  const errors: SerialCsvRowError[] = [];
  const seenInFile = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const cols = splitCsvLine(lines[i]!);
    const sku = (cols[idxSku] ?? "").toUpperCase();
    const serialNumber = (cols[idxSerial] ?? "").toUpperCase();
    const imeiRaw = idxImei >= 0 ? cols[idxImei] ?? "" : "";
    const batchRaw = idxBatch >= 0 ? cols[idxBatch] ?? "" : "";
    const channelRaw = (idxChannel >= 0 ? cols[idxChannel] ?? "" : "").toUpperCase();
    const orderRaw = idxOrder >= 0 ? cols[idxOrder] ?? "" : "";
    const soldAtRaw = idxSoldAt >= 0 ? cols[idxSoldAt] ?? "" : "";

    if ([sku, serialNumber, imeiRaw, batchRaw, orderRaw].some(hasFormulaPrefix)) {
      errors.push({
        rowNumber,
        serialNumber: serialNumber || "-",
        reason: "Unsafe spreadsheet formula prefix (=, +, -, @) rejected.",
      });
      continue;
    }

    if (!sku || !params.knownSkus.has(sku)) {
      errors.push({
        rowNumber,
        serialNumber: serialNumber || "-",
        reason: `Unknown product SKU "${sku || "(blank)"}". Create the SKU first.`,
      });
      continue;
    }

    if (!/^[A-Z0-9][A-Z0-9_-]{3,39}$/.test(serialNumber)) {
      errors.push({
        rowNumber,
        serialNumber: serialNumber || "-",
        reason: "Serial number must be 4-40 alphanumeric characters (hyphens/underscores allowed).",
      });
      continue;
    }

    if (seenInFile.has(serialNumber)) {
      errors.push({
        rowNumber,
        serialNumber,
        reason: "Duplicate serial_number within uploaded CSV file.",
      });
      continue;
    }

    if (params.existingSerials.has(serialNumber)) {
      errors.push({
        rowNumber,
        serialNumber,
        reason: "Serial number already exists in this workspace registry.",
      });
      continue;
    }

    if (imeiRaw && !/^\d{15}$/.test(imeiRaw)) {
      errors.push({
        rowNumber,
        serialNumber,
        reason: "IMEI must be exactly 15 digits when supplied.",
      });
      continue;
    }

    const salesChannel: SalesChannel = (SALES_CHANNELS as readonly string[]).includes(channelRaw)
      ? (channelRaw as SalesChannel)
      : "D2C_WEB";

    let soldAt: Date | null = null;
    if (soldAtRaw) {
      const parsedDate = new Date(soldAtRaw);
      if (Number.isNaN(parsedDate.getTime())) {
        errors.push({
          rowNumber,
          serialNumber,
          reason: `Invalid sold_at date "${soldAtRaw}" (expected YYYY-MM-DD).`,
        });
        continue;
      }
      soldAt = parsedDate;
    }

    seenInFile.add(serialNumber);
    validRows.push({
      rowNumber,
      sku,
      serialNumber,
      imei: imeiRaw || null,
      batchCode: batchRaw ? batchRaw.toUpperCase() : null,
      salesChannel,
      externalOrderId: orderRaw || null,
      soldAt,
    });
  }

  return {
    totalRows: lines.length - 1,
    validRows,
    errors,
  };
}

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
