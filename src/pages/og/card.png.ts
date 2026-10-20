/**
 * Ad-hoc Open Graph card endpoint.
 *
 * GET /og/card.png?title=…&subtitle=…&label=…
 *
 * Renders the same branded 1200x630 card the per-entry endpoint uses, but from
 * query params instead of an entry. This lets content blocks (Feature Section,
 * Slider, …) show a themed "OG-style" visual when no image is set, with zero
 * upload — the visual stays perfectly on-brand. Long cache + stable ETag.
 */
import type { APIRoute } from "astro";
import { getSiteSettings } from "emdash";
import { buildOgCard, renderOgPng, type OgCardData } from "../../lib/og/og-card";
import { resolveBlogSiteIdentity } from "../../utils/site-identity";

export const prerender = false;

function sk(value: string | null, max = 180): string {
	return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function canonicalOrigin(url: URL): string {
	const configured = import.meta.env.SITE || process.env.EMDASH_SITE_URL || process.env.SITE_URL;
	if (configured) return String(configured).replace(/\/$/, "");
	return url.origin;
}

function etagFor(seed: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return `"ogc-${(h >>> 0).toString(36)}"`;
}

export const GET: APIRoute = async ({ request, url }) => {
	const origin = canonicalOrigin(url);
	const title = sk(url.searchParams.get("title"), 160);
	if (!title) return new Response("Missing title", { status: 400 });

	const subtitle = sk(url.searchParams.get("subtitle"), 200);
	const label = sk(url.searchParams.get("label"), 40);

	const { siteTitle } = resolveBlogSiteIdentity(await getSiteSettings());

	const card: OgCardData = {
		siteTitle,
		label: label || "Kotacom",
		title,
		excerpt: subtitle || null,
		domain: new URL(origin).host,
	};

	const png = await renderOgPng(buildOgCard(card));
	const etag = etagFor(`${siteTitle}|${label}|${title}|${subtitle}`);

	const inm = request.headers.get("if-none-match");
	if (inm && inm === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}

	return new Response(new Uint8Array(png), {
		status: 200,
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
			ETag: etag,
		},
	});
};
