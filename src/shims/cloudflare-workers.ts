/**
 * Node shim for the `cloudflare:workers` virtual module.
 *
 * `emdash-better-auth` reads runtime secrets through Cloudflare's `env`
 * binding (`import { env } from "cloudflare:workers"`). That virtual module
 * only exists on the Workers runtime; on our self-hosted Node adapter the
 * build fails with `Rolldown failed to resolve import "cloudflare:workers"`.
 *
 * Alias `cloudflare:workers` -> this file (see astro.config.mjs) so `env`
 * resolves to `process.env`, which is exactly the same shape the plugin
 * expects (`Record<string, string | undefined>`) and is populated from the
 * container environment / `.env`.
 *
 * The plugin is only ever *server-side* here (it reads BETTER_AUTH_SECRET,
 * social OAuth creds, Stripe keys, etc.), so mapping to process.env is safe
 * and complete for our deployment.
 */

export const env: Record<string, string | undefined> = process.env;

export default { env };
