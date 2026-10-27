import "server-only";
import { z } from "zod";
import { parseDomainList, parseEmailList } from "@/lib/email-domain";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    APP_URL: z.url().default("http://localhost:3000"),
    AUTH_MODE: z.enum(["supabase", "dev"]).default("supabase"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    ALLOWED_EMAIL_DOMAINS: z.string().min(1, "ALLOWED_EMAIL_DOMAINS is required"),
    // Temporary: exact non-college addresses allowed in for testing (comma-separated). Delete to switch off.
    TEST_EMAILS: z.string().optional(),
    DEFAULT_COLLEGE_SLUG: z.string().optional(),
    DEV_AUTH_SECRET: z.string().optional(),
    // Lets a local `next start` use dev sign-in for Lighthouse/E2E runs. Refused on Vercel.
    RESTIX_LOCAL_PROD_TEST: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === "dev" && (!env.DEV_AUTH_SECRET || env.DEV_AUTH_SECRET.length < 32)) {
      ctx.addIssue({ code: "custom", path: ["DEV_AUTH_SECRET"], message: "dev auth needs DEV_AUTH_SECRET (32+ chars)" });
    }
  });

export type Env = z.infer<typeof schema> & { allowedDomains: string[]; testEmails: string[] };

let cached: Env | undefined;

/** Validated server configuration. Throws with a readable message when something is missing. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server configuration: ${issues}`);
  }
  cached = {
    ...parsed.data,
    allowedDomains: parseDomainList(parsed.data.ALLOWED_EMAIL_DOMAINS),
    testEmails: parseEmailList(parsed.data.TEST_EMAILS),
  };
  return cached;
}

/** Whether Google sign-in through Supabase has the configuration it needs. */
export function supabaseAuthConfigured(): boolean {
  const e = env();
  return Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Development sign-in is for local work only. It is refused in production builds,
 * except a local `next start` explicitly opted in with RESTIX_LOCAL_PROD_TEST=1,
 * and never on Vercel.
 */
export function devAuthEnabled(): boolean {
  const e = env();
  if (e.AUTH_MODE !== "dev") return false;
  if (process.env.VERCEL) return false;
  if (process.env.NODE_ENV === "production" && e.RESTIX_LOCAL_PROD_TEST !== "1") return false;
  return true;
}
