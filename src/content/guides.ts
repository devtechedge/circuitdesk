export interface OperationsGuide {
  slug: string;
  title: string;
  category: string;
  readMinutes: number;
  publishedIso: string;
  summary: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
}

export const OPERATIONS_GUIDES: readonly OperationsGuide[] = [
  {
    slug: "india-electronics-warranty-gst-guide",
    title: "GST on Electronics Warranty Replacements and ASC Repairs in India (CBIC 195/2023 & 216/2024)",
    category: "India Tax & Compliance",
    readMinutes: 6,
    publishedIso: "2026-11-01",
    summary:
      "How D2C hardware CFOs and operations leads separate zero-GST OEM warranty replacements from taxable Authorised Service Centre reimbursements without erroneously reversing ITC.",
    sections: [
      {
        heading: "1. Free OEM Replacement During Warranty Carries Zero GST and Zero ITC Reversal",
        paragraphs: [
          "Under CBIC Circular No. 195/07/2023-GST (dated 17 July 2023) and Circular No. 216/10/2024-GST, when an original equipment manufacturer replaces defective parts or an entire product free of cost within the promised warranty window, no additional GST is payable.",
          "Because the expected warranty obligation was already priced and taxed at the time of the principal sale of goods, the replacement is not treated as an exempt supply, and no Input Tax Credit (ITC) reversal under Section 17(2) of the CGST Act is required.",
        ],
      },
      {
        heading: "2. Partner Authorised Service Centre (ASC) Repairs Are Taxable B2B Supplies",
        paragraphs: [
          "When a third-party Authorised Service Centre repairs a customer unit free of charge and invoices the brand for labour or locally sourced spare parts, a taxable supply exists between the ASC and the OEM under Section 7 of the CGST Act.",
          "The ASC issues a tax invoice in the OEM's name under SAC 9987 (9% CGST + 9% SGST intra-state or 18% IGST inter-state), and the OEM is eligible to claim ITC on that invoice.",
        ],
      },
      {
        heading: "3. Structuring Operational Exports for Monthly GST Filing",
        paragraphs: [
          "Mixing free customer replacements and partner ASC settlements in one spreadsheet creates audit reconciliation friction. CircuitDesk exports two distinct CSV registers: an OEM Warranty Replacement Register (recording HSN, defective masked serial, RMA challan, and INR 0.00 customer tax) and an ASC B2B Reimbursement Register.",
        ],
      },
    ],
  },
  {
    slug: "serial-batch-defect-tracking-d2c",
    title: "Designing Serial, IMEI and Factory Batch Lineage to Catch Rogue Supplier Lots Early",
    category: "Quality & Supply Chain",
    readMinutes: 5,
    publishedIso: "2026-11-03",
    summary:
      "Why SKU-level return rates hide supplier defects, and how joining serial numbers to factory lot codes surfaces bad cell or PCB runs within weeks.",
    sections: [
      {
        heading: "1. Why SKU-Level Averages Hide Acute Lot Failures",
        paragraphs: [
          "Suppose a wireless earbud SKU averages 14 warranty claims per 1,000 units across 10,000 units sold. If one 800-unit battery pack lot from a secondary supplier fails at 65 per 1,000 while older lots run at 9 per 1,000, SKU-level averages mask the spike until hundreds of defective units ship.",
        ],
      },
      {
        heading: "2. Minimum Viable Serial Registry Columns",
        paragraphs: [
          "Every serialized electronics SKU should record sku, serial_number, optional 15-digit imei, batch_code, supplier_name, factory_code, and manufactured_at before warehouse dispatch.",
          "Validating serials at CSV import prevents duplicate serial labels and blocks spreadsheet formula injection (=, +, -, @) before support agents ever open an export.",
        ],
      },
      {
        heading: "3. Human-Approved Recall Audiences and Supplier Recovery",
        paragraphs: [
          "When batch analytics flag an anomalous lot, linking registrations to serials lets operations draft an affected-owner list immediately while keeping outbound recall notifications strictly gated behind Owner or Admin human approval.",
        ],
      },
    ],
  },
  {
    slug: "shopify-warranty-registration-vs-claims-ops",
    title: "Registration Widgets vs Full Warranty Adjudication: What Growing Shopify Brands Miss",
    category: "Ecommerce Architecture",
    readMinutes: 5,
    publishedIso: "2026-11-05",
    summary:
      "Why collecting post-purchase QR registrations or selling third-party extended protection plans still leaves statutory 1-year hardware claims stuck in email.",
    sections: [
      {
        heading: "1. Two Different App Categories Sharing One Keyword",
        paragraphs: [
          "Most storefront warranty apps either collect owner emails via a post-purchase registration form or sell third-party underwritten extended protection plans at checkout.",
          "Neither executes the brand's own 12-to-24 month manufacturer warranty: verifying coverage windows per channel, reading fault photos, checking spare-part inventory, or routing benches.",
        ],
      },
      {
        heading: "2. Turning Registration Into an Adjudication Input",
        paragraphs: [
          "Registration pays off when the claim intake engine automatically joins the submitted serial number to its verified purchase date, sales channel, and warranty policy snapshot, eliminating back-and-forth receipt hunts.",
        ],
      },
    ],
  },
  {
    slug: "pin-code-service-centre-routing-sla",
    title: "Routing Hardware Repairs Across Indian 6-Digit PIN Zones Without Bench Bottlenecks",
    category: "Service Network Ops",
    readMinutes: 5,
    publishedIso: "2026-11-08",
    summary:
      "Balancing geographic proximity, product-category bench certification, and active job caps across owned hubs and Authorised Service Centres.",
    sections: [
      {
        heading: "1. Why Nearest-City Routing Alone Fails During Festival Peaks",
        paragraphs: [
          "After major Q3/Q4 festive sales in India, metro walk-in and courier benches in Mumbai (400xxx), Bengaluru (560xxx), and NCR (110xxx/122xxx) hit Technician capacity unevenly.",
          "Routing solely by static state tables sends high-voltage GaN or heating-appliance jobs to audio-only benches or overloads a single partner workshop.",
        ],
      },
      {
        heading: "2. Prefix + Skill + Load Utilization Scoring",
        paragraphs: [
          "CircuitDesk's router filters centres by active status, category skill certification, and remaining bench slots (activeRepairsCount < maxActiveRepairs), then ranks longest PIN prefix match alongside load utilization.",
        ],
      },
    ],
  },
];

export function getGuideBySlug(slug: string): OperationsGuide | undefined {
  return OPERATIONS_GUIDES.find((g) => g.slug === slug);
}
