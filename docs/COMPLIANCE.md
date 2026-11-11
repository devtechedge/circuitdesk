# Privacy, Consumer Protection and GST Compliance Notes

Note: This document records engineering controls implemented in CircuitDesk. It is not legal or tax advice; all public legal pages (`/privacy`, `/terms`, `/dpa`) carry explicit legal-review notices.

## 1. India Digital Personal Data Protection Act, 2023 (DPDP Act)

- **Consent Notice**: `/w/[brand]/register` requires an explicit, unchecked-by-default consent checkbox recording `consent_accepted_at` and `consent_version` (`dpdp-2026.1`).
- **Data Minimization & Masking**: Customer portals require zero password accounts; public certificate and tracking views display masked serials (`KNX-****8901`), and `ANALYST` / `READ_ONLY` operator roles receive masked serials/IMEIs automatically.
- **Data Principal Rights**: `POST /api/app/settings` (`dpdp_export` and `dpdp_erase`) exports a JSON dossier or redacts customer PII (`[ERASED-DPDP]`) and revokes active portal tokens while preserving aggregate non-PII financial/HSN records for statutory audit.

## 2. Consumer Protection Act, 2019, Right to Repair & E-Waste Rules, 2022

- **Transparent Terms**: Digital warranty certificates clearly display start/end dates, covered fault categories, and exclusions.
- **Human Recall Approval**: Batch failure analytics can draft a recall campaign, but `approveRecallCampaign` enforces `recall:approve` (`OWNER`/`ADMIN` only) before a recall audience is marked ready.
- **E-Waste Manifests**: RMA disposition `SCRAP_EWASTE` requires a non-empty `ewasteManifestRef` to maintainrecycler traceability.
- **EU Repair Extension**: `evaluateCoverageWindow` supports `repairExtensionMonths` for brands shipping into EU jurisdictions under Directive (EU) 2024/1799.

## 3. GST Warranty Accounting (CBIC Circulars 195/07/2023-GST & 216/10/2024-GST)

- `GET /api/app/exports/gst?type=oem_replacements`: exports zero-GST OEM customer warranty replacements (`customer_taxable_value_inr = 0.00`, `itc_reversal_required = NO`).
- `GET /api/app/exports/gst?type=asc_reimbursements`: exports Authorised Service Centre B2B repair settlements under SAC `9987` with 9%+9% CGST/SGST (same 2-digit GSTIN state prefix) or 18% IGST (inter-state).
