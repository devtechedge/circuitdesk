# Market, Competitor and Regulatory Research

Recorded: 11 November 2026

## 1. Sibling Repository Audit (Non-Duplication Boundary)

Before designing CircuitDesk, existing `devtechedge` repositories were audited to ensure zero overlap in domain model, workflow, visual palette, or typography:

| Repository | Domain | Palette and Typography | Differentiation Boundary for CircuitDesk |
| --- | --- | --- | --- |
| CareProof (`careproof`) | Monthly website care audits and client reports for web agencies | Clean report surface, agency portal | CircuitDesk manages physical serialized hardware, warranty terms, bench repairs, spare parts, and RMAs. |
| Gatefold (`gatefold`) | Event publishing, 10-minute inventory holds, signed QR tickets, mobile check-in | Event operations palette | CircuitDesk tracks post-sale device serials/IMEIs, fault evidence, and repair benches rather than event capacity or venue check-ins. |
| Vialform (`vialform`) | Institution-verified B2B peptide research procurement with jurisdiction compliance | Cobalt (`#2456e6`), Inter + JetBrains Mono | CircuitDesk serves consumer electronics/hardware after-sales operations, not regulated laboratory procurement or scientific dossiers. |
| AstraMart (`astra-marketplace`) | Storefront, cart, seller portal, and admin back-office | Paper (`#F4EFE6`) + copper (`#C45C26`), Fraunces + IBM Plex Sans | CircuitDesk is not a storefront, shopping cart, or multi-seller marketplace. It begins after the sale happens. |
| NexusBazaar (`nexus-bazaar`) | Client-side buyer/seller/B2B RFQ marketplace | Client-side storefront + promo checkout | CircuitDesk is a server-authenticated, PostgreSQL-backed after-sales system of record, not a shopping or auction storefront. |
| Motif (`motif`) | Procedural browser soundscape synthesizer | Night navy + gold, Fraunces + Instrument Sans + Spline Sans Mono | Zero audio synthesis or generative canvas surfaces. |
| Cutroom (`cutroom`) | Storyboard and visual narrative studio | Charcoal + warm paper + acid-lime (`#d7f04c`), Space Grotesk + Source Serif 4 + IBM Plex Mono | Zero frame-editing canvas, timeline scrubbing, or storyboard export. |
| Worldline (`worldline`) | Interactive Natural Earth systems atlas | Porcelain + cobalt/vermilion, Newsreader + Archivo | Zero cartographic projection or scenario modelling. |
| Understory (`understory`) | Deterministic browser terrarium | Humus + moss + bioluminescent mint, Bricolage Grotesque + Literata + Martian Mono | Zero simulation game loop or Canvas 2D diorama. |

CircuitDesk adopts its own industrial-modern visual identity: cool graphite-navy dark surfaces (`#0d131c` / `#141d2b`), cool titanium-silver light surfaces (`#e6eaef` / `#f4f6f9`), high-visibility Signal Orange (`#ea580c` / `#fb923c`) and Industrial Cobalt (`#1d4ed8` / `#60a5fa`), paired with self-hosted Plus Jakarta Sans and Azeret Mono for serial/IMEI/batch legibility.

---

## 2. Verified Category Signals (2026)

All external numbers below describe industry-wide merchant surveys and third-party vendor datasets. They demonstrate that post-purchase abuse and structured exchanges/warranties are an established operational problem; they do not represent CircuitDesk market share, guaranteed customer savings, or revenue forecasts.

1. **Merchant Risk Council (MRC), Visa Acceptance Solutions and Verifi - 2026 Global eCommerce Payments & Fraud Report (published April/May 2026, checked 11 Nov 2026)**
   - Source: `merchantriskcouncil.org/learning/mrc-exclusive-reports/global-payments-and-fraud-report` and report summary (`VISA-2026_Global_eCommerce_PaymentsandFraudReport.pdf`, Figures 24 and 39).
   - Verified findings: **41%** of surveyed global merchants cite refund and policy abuse as their highest-incidence fraud attack type, ranking first ahead of real-time payment fraud (38%) and phishing (37%). **61%** of surveyed merchants report an increase in refund/policy abuse over the prior 12 months (with 20% reporting spikes of 25% or more). Primary abuse patterns include false non-receipt claims (52%) and returning used, damaged, or out-of-window goods (44%).
   - Operational implication for hardware brands: unstructured email/WhatsApp warranty claims without serial registry validation, duplicate-serial detection, and photo/receipt verification expose high-COGS electronics brands to repeated replacements.

2. **Loop Returns - 2026 Global Ecommerce Report: Retention Benchmarks of High-Performing Brands (checked 11 Nov 2026)**
   - Source: `https://www.loopreturns.com/reports/retention-benchmarks-2026`
   - Verified findings: Across Loop's merchant dataset, **73.6%** of merchants offer exchanges and **49.2%** offer Shop Now (instant catalog exchange during a return), with 51.7% of Shop Now merchants pairing it with bonus credit.
   - Operational implication: Apparel-oriented return portals excel at size/style exchanges, whereas hardware and electronics brands require fault adjudication, PIN-routed bench repair, spare part consumption, DOA vs wear-and-tear rules, and supplier batch failure tracking.

---

## 3. Competitor Landscape and Pricing (Checked 11 Nov 2026)

| Vendor | URL Checked | Published Pricing (11 Nov 2026) | Strengths | Gaps for India-First / Global D2C Hardware Brands (500-50,000 units/mo) |
| --- | --- | --- | --- | --- |
| AfterShip Warranty | `https://www.aftership.com/warranty` | Custom enterprise quote ("Book a demo") | Branded portal, omnichannel warranty claims, carrier reverse logistics, product recall workflows | Enterprise sales gate; lacks transparent self-serve INR/USD tiers, Indian 6-digit PIN service-centre routing, and GST warranty challan/ASC settlement exports. |
| Dyrect | `https://www.dyrect.co/pricing` | Free ($0, 100 lifetime credits, 1 user); Registration **$19/mo**; Claims **$49/mo**; Claims Pro **$149/mo** (100 monthly credits included, $0.20/extra credit, 1-3 seats; repairs gated to $149 tier) | Clean QR registration, digital warranty cards, Shopify app, India + US presence | Base credit bundle (100 actions/mo) scales steeply via per-credit overages once a brand registers 1,500-10,000 units/mo; deep bench repair technician queues, spare-part stock ledgers, and supplier lot failure cost recovery need dedicated ops tooling. |
| Resolvi | `https://www.resolvi.io/pricing` | Core **$79/mo** (200 cases/mo, no CSV export, no custom fault types); Pro **$169/mo** (500 cases/mo, stockist claims); Plus **$299/mo** (800 cases/mo, fault gallery); Enterprise **$599/mo** | Structured fault intake, Shopify theme portal, COGS+shipping analytics, unlimited seats | Tightly coupled to Shopify theme extensions; does not target multi-channel Indian D2C brands selling across Amazon/Flipkart/offline dealers with walk-in/hub PIN service centres and GST ITC accounting. |
| Claimlane | `https://www.claimlane.com/resources/blog/best-shopify-warranty-apps` (updated 21 Aug 2026) | Sales-led demo pricing | Unifies registration, claim adjudication, repairs, spare parts, and forward-to-supplier credit recovery | Western ERP-heavy positioning (NetSuite, SAP, Business Central); lacks transparent SMB/mid-market INR pricing and Indian GST/PIN-zone workflows. |
| Shopify App Store Category | `https://apps.shopify.com/` | $0-$149/mo for registration widgets; revenue-share for third-party extended warranty insurance (SureBright, Mulberry) | Easy 1-click install for storefront order capture | As Claimlane's August 2026 analysis notes, registration widgets only store owner + date, while extended-warranty apps outsource underwritten plans and do not run the brand's own 1-year statutory manufacturer warranty or repair bench. |

---

## 4. Indian After-Sales, Tax and Privacy Rules

Note: Regulatory summaries below inform software workflow design and export schemas. They are engineering requirements, not legal or tax advice.

1. **GST on Warranty Replacements and Authorised Service Centres (CBIC Circular No. 195/07/2023-GST dated 17 Jul 2023 & Circular No. 216/10/2024-GST)**
   - When an OEM replaces defective parts or whole goods free of charge during the warranty period, no separate GST is chargeable and **no Input Tax Credit (ITC) reversal** is required by the OEM because warranty consideration was already taxed in the original sale price.
   - When an Authorised Service Centre (ASC) or distributor performs repair services (SAC `9987`) or supplies parts on behalf of the OEM and bills the OEM for reimbursement, that B2B transaction is a taxable supply from the ASC to the OEM; the ASC issues a tax invoice to the OEM, and the OEM can claim ITC. Stock replenishment from OEM to distributor/ASC against warranty replacement without charge is non-taxable via delivery challan.
   - CircuitDesk therefore provides dedicated CSV registers separating zero-GST OEM customer warranty replacements from taxable B2B ASC service settlement lines.

2. **Consumer Protection Act, 2019 & Right to Repair Portal India (`righttorepairindia.gov.in`, launched July 2023)**
   - Sections 2(9), 2(11), and 2(47) of the Consumer Protection Act, 2019 cover product defects, after-sales service deficiencies, and consumer rights to transparent warranty terms and spare-part availability across Mobiles/Electronics and Consumer Durables.
   - CircuitDesk publishes clear policy terms on every digital warranty certificate and tracks SLA clocks from claim intake to dispatch.

3. **E-Waste (Management) Rules, 2022 (India)**
   - Unrepairable hardware and swapped lithium batteries/PCBs scrapped at service benches must be routed to authorised e-waste recyclers rather than general disposal. CircuitDesk's RMA disposition model includes explicit `SCRAP_EWASTE` and `RETURN_TO_VENDOR` states with recycler/batch references.

4. **Digital Personal Data Protection Act, 2023 (DPDP Act, India) & EU Directive (EU) 2024/1799**
   - Customer portal forms capture explicit, itemized consent notice with stated retention windows, serial masking in public views, and self-service/operator Data Principal JSON export and PII erasure tools.
   - For global brands shipping to the EU, Directive (EU) 2024/1799 (applicable from 31 July 2026) extends the statutory guarantee by 12 months when a consumer elects repair under the legal guarantee; CircuitDesk's policy engine supports optional repair-triggered coverage extension months per region.

---

## 5. Official Commerce & Messaging Integration Constraints

- **Shopify**: Official integration requires either a Shopify Partners custom/public OAuth app (`read_orders`, `read_products`, `read_fulfillments`) or signed `orders/create` and `orders/fulfilled` webhooks verified via `X-Shopify-Hmac-Sha256` using the store's webhook secret, plus Shopify Order CSV import. Public App Store listing requires Shopify review; CircuitDesk labels public App Store listing as pending while providing working OAuth initiation, verified HMAC webhook ingestion, and CSV sync.
- **WooCommerce**: Supports REST API v3 consumer key/secret (stored encrypted with AES-256-GCM) and `X-WC-Webhook-Signature` HMAC-SHA256 order webhooks.
- **Amazon India & Flipkart**: Direct order access requires approved Amazon SP-API or Flipkart Seller API credentials. Scraping is brittle and prohibited by platform terms. CircuitDesk strictly ingests marketplace orders via merchant-exported CSV reports or verified webhook bridges, and requires receipt verification for offline/unverified marketplace claims.
- **WhatsApp Business (Meta Cloud API)**: Requires a verified Meta Business Account, Phone Number ID, access token, and pre-approved utility message templates. CircuitDesk records outbound messages in a local dev sink when credentials are absent and marks delivery `DELIVERED_CONFIRMED` only upon receiving a signed Meta status webhook.
