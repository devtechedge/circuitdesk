import { existsSync } from "node:fs";
import { z } from "zod";

let dotenvLoaded = false;

function ensureDotenvLoaded(): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
    try {
      if (existsSync(".env")) {
        process.loadEnvFile(".env");
      }
    } catch {
      // Runtime environment variables take precedence when .env is unavailable.
    }
  }
}

const DEV_AUTH_SECRET = "dev-only-circuitdesk-auth-secret-change-in-production-32b";
const DEV_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DEV_FILE_SECRET = "dev-only-circuitdesk-file-signing-secret-change-prod-32b";
const DEV_WEBHOOK_SECRET = "dev-only-circuitdesk-webhook-signing-secret-change-32b";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DEMO_MODE: z.enum(["true", "false"]).default("true"),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  AUTH_SECRET: z.string().min(32).default(DEV_AUTH_SECRET),
  ENCRYPTION_KEY: z.string().min(32).default(DEV_ENCRYPTION_KEY),
  FILE_SIGNING_SECRET: z.string().min(32).default(DEV_FILE_SECRET),
  WEBHOOK_SIGNING_SECRET: z.string().min(32).default(DEV_WEBHOOK_SECRET),
  ALLOW_PROD_SEED: z.string().optional(),

  // Global & India billing providers (optional; missing keys activate non-charging demo billing)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER_USD: z.string().optional(),
  STRIPE_PRICE_GROWTH_USD: z.string().optional(),
  STRIPE_PRICE_SCALE_USD: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_STARTER_INR: z.string().optional(),
  RAZORPAY_PLAN_GROWTH_INR: z.string().optional(),
  RAZORPAY_PLAN_SCALE_INR: z.string().optional(),

  // Commerce connectors (optional)
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
  WOOCOMMERCE_WEBHOOK_SECRET: z.string().optional(),

  // Messaging & Email (optional; missing keys route to audited dev sink)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("CircuitDesk Ops <ops@circuitdesk.example>"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),

  // Optional AI triage assistant (server-only; deterministic fallback when unset)
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-4o-mini"),

  // Optional external blob prefix; encrypted Postgres blob store is always active
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  ensureDotenvLoaded();
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const env = parsed.data;
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const isHostedProduction =
    process.env.VERCEL_ENV === "production" || process.env.REQUIRE_PROD_SECRETS === "1";

  if (env.NODE_ENV === "production" && isHostedProduction && !isBuildPhase) {
    if (
      env.AUTH_SECRET === DEV_AUTH_SECRET ||
      env.ENCRYPTION_KEY === DEV_ENCRYPTION_KEY ||
      env.FILE_SIGNING_SECRET === DEV_FILE_SECRET
    ) {
      throw new Error(
        "Production deployment requires non-default AUTH_SECRET, ENCRYPTION_KEY and FILE_SIGNING_SECRET."
      );
    }
  }
  cachedEnv = env;
  return env;
}

export function isDemoMode(): boolean {
  return getEnv().DEMO_MODE === "true";
}

export function getProviderCapabilities() {
  const env = getEnv();
  return {
    database: Boolean(env.DATABASE_URL?.trim()) ? ("postgres" as const) : ("pglite" as const),
    stripe: Boolean(env.STRIPE_SECRET_KEY?.trim()),
    razorpay: Boolean(env.RAZORPAY_KEY_ID?.trim() && env.RAZORPAY_KEY_SECRET?.trim()),
    shopifyOAuth: Boolean(env.SHOPIFY_CLIENT_ID?.trim() && env.SHOPIFY_CLIENT_SECRET?.trim()),
    emailLive: Boolean(env.RESEND_API_KEY?.trim()),
    whatsappLive: Boolean(
      env.WHATSAPP_ACCESS_TOKEN?.trim() && env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    ),
    aiLive: Boolean(env.AI_API_KEY?.trim()),
  };
}
