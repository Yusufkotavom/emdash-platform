/**
 * Dynamic Open Graph card endpoint.
 *
 * GET /og/:collection/:slug.png
 *
 * Renders a branded 1200x630 social card for any published entry, so every
 * post/page gets a unique og:image with zero per-entry work. The layout matches
 * the site theme; when the entry has a featured image it is shown (grayscale)
 * in a side panel, otherwise the card is pure type. Content-hash ETag + long
 * cache headers keep repeat scrapes cheap.
 *
 * Unknown collections/slugs get a neutral site card so scrapers never see a
 * broken image.
 */
import type { APIRoute } from "astro";
import { getEmDashEntry, getSiteSettings, decodeSlug } from "emdash";
import { buildOgCard, renderOgPng, toGrayscaleDataUri, type OgCardData } from "../../../lib/og/og-card";
import { resolveBlogSiteIdentity } from "../../../utils/site-identity";

export const prerender = false;

const COLLECTIONS = new Set(["posts", "pages", "page_templates", "products"]);

/** Uppercase micro-label for the card's top-right corner. */
const LABELS: Record<string, string> = {
	posts: "Artikel",
	pages: "Halaman",
	page_templates: "Template",
	products: "Produk",
};

/** Canonical origin: prefer the configured site URL over the request host. */
function canonicalOrigin(url: URL): string {
	const configured = import.meta.env.SITE || process.env.EMDASH_SITE_URL || process.env.SITE_URL;
	if (configured) return String(configured).replace(/\/$/, "");
	return url.origin;
}

/** Concatenate inline spans of a block tightly (no space before punctuation). */
function inlineText(children: unknown): string {
	let s = "";
	if (!Array.isArray(children)) return s;
	for (const c of children) {
		if (c && typeof c === "object") {
			const o = c as Record<string, unknown>;
			if (typeof o.text === "string") s += o.text;
			if (Array.isArray(o.children)) s += inlineText(o.children);
		} else if (typeof c === "string") {
			s += c;
		}
	}
	return s;
}

/** Find the first body paragraph (skips headings/quotes/code) in a content tree. */
function firstParagraph(node: unknown): string | null {
	if (!node) return null;
	if (Array.isArray(node)) {
		for (const n of node) {
			const r = firstParagraph(n);
			if (r) return r;
		}
		return null;
	}
	if (typeof node === "object") {
		const o = node as Record<string, unknown>;
		const type = typeof o._type === "string" ? o._type : "";
		const style = typeof o.style === "string" ? o.style : "";
		if (type === "block" && Array.isArray(o.children)) {
			if (!/^h[1-6]$/.test(style) && style !== "blockquote") {
				const t = inlineText(o.children).trim();
				if (t) return t;
			}
			return null;
		}
		if (Array.isArray(o.children) && typeof o.text !== "string") {
			const t = inlineText(o.children).trim();
			if (t) return t;
		}
		for (const key of ["content", "blocks", "body", "items"]) {
			if (o[key]) {
				const r = firstParagraph(o[key]);
				if (r) return r;
			}
		}
	}
	return null;
}

/** Collect one plain-text string per block from PortableText / blocks content. */
function extractText(node: unknown, out: string[]): void {
	if (!node) return;
	if (Array.isArray(node)) {
		for (const n of node) extractText(n, out);
		return;
	}
	if (typeof node === "object") {
		const o = node as Record<string, unknown>;
		const type = typeof o._type === "string" ? o._type : "";
		if (type === "code") return;
		if (Array.isArray(o.children)) {
			const t = inlineText(o.children);
			if (t.trim()) out.push(t);
			return;
		}
		if (typeof o.text === "string" && o.text.trim()) {
			out.push(o.text);
			return;
		}
		for (const key of ["content", "blocks", "body", "items"]) {
			if (o[key]) extractText(o[key], out);
		}
	}
}

/** Flatten PortableText / blocks content to a single plain-text string. */
function flattenText(content: unknown): string {
	const parts: string[] = [];
	extractText(content, parts);
	return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Approximate word count of the rendered body (for reading time). */
function collectWords(content: unknown): number {
	const flat = flattenText(content);
	return flat ? flat.split(/\s+/).length : 0;
}

/** Derive a short excerpt: the first body paragraph, else the flattened text. */
function deriveExcerpt(content: unknown, max = 150): string | null {
	const flat = firstParagraph(content) ?? flattenText(content);
	if (!flat) return null;
	if (flat.length <= max) return flat;
	const cut = flat.slice(0, max);
	const sp = cut.lastIndexOf(" ");
	return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

/** Resolve a featured-image field (external src or local storage key) to a URL. */
function featuredImageUrl(img: unknown, origin: string): string | undefined {
	if (!img || typeof img !== "object") return undefined;
	const image = img as Record<string, unknown>;
	if (typeof image.src === "string" && image.src) {
		return image.src.startsWith("http") ? image.src : `${origin}${image.src}`;
	}
	const meta = image.meta as Record<string, unknown> | undefined;
	const storageKey =
		(typeof meta?.storageKey === "string" ? meta.storageKey : undefined) ||
		(typeof image.id === "string" ? image.id : undefined);
	if (storageKey) return `${origin}/_emdash/api/media/file/${storageKey}`;
	return undefined;
}

function pngResponse(png: Buffer, etagSeed: string): Response {
	// Cheap, stable ETag: FNV-1a over the render inputs.
	let h = 0x811c9dc5;
	for (let i = 0; i < etagSeed.length; i++) {
		h ^= etagSeed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	const etag = `"og-${(h >>> 0).toString(36)}"`;
	return new Response(new Uint8Array(png), {
		status: 200,
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
			ETag: etag,
		},
	});
}

/** Neutral fallback card (unknown entry, or one missing a usable title). */
async function renderSiteCard(origin: string): Promise<Response> {
	const { siteTitle, siteTagline } = resolveBlogSiteIdentity(await getSiteSettings());
	const node = buildOgCard({
		siteTitle,
		label: "Kotacom",
		title: siteTitle.trim(),
		excerpt: siteTagline,
		domain: new URL(origin).host,
	});
	return pngResponse(await renderOgPng(node), "site");
}

export const GET: APIRoute = async ({ params, request, url }) => {
	const collection = String(params.collection ?? "");
	const slug = decodeSlug(String(params.slug ?? ""));
	if (!COLLECTIONS.has(collection) || !slug) {
		return new Response("Not found", { status: 404 });
	}

	const origin = canonicalOrigin(url);

	let entry: Awaited<ReturnType<typeof getEmDashEntry>> | null = null;
	try {
		const { entry: e } = await getEmDashEntry(collection, slug);
		entry = e;
	} catch {
		entry = null;
	}

	if (!entry) return renderSiteCard(origin);

	const data = entry.data as Record<string, unknown>;
	const rawTitle = typeof data.title === "string" ? data.title : "";
	if (!rawTitle.trim()) return renderSiteCard(origin);

	// Excerpt: prefer the explicit field, else derive from the content body.
	const explicitExcerpt = typeof data.excerpt === "string" && data.excerpt.trim() ? data.excerpt : null;
	const content = data.portableText ?? data.content ?? data.blocks ?? null;
	const excerpt = explicitExcerpt ?? deriveExcerpt(content);

	const { siteTitle } = resolveBlogSiteIdentity(await getSiteSettings());

	// Footer meta: publish month/year + reading time (the site's own metric).
	const publishedAt = data.publishedAt;
	const words = content ? collectWords(content) : 0;
	const readMin = words > 0 ? Math.max(1, Math.round(words / 200)) : 0;
	const dateLabel =
		typeof publishedAt === "string"
			? new Date(publishedAt).toLocaleDateString("id-ID", { year: "numeric", month: "short" })
			: null;
	const metaParts = [dateLabel, readMin > 0 ? `${readMin} menit baca` : null].filter(Boolean);
	const meta = metaParts.length ? metaParts.join("  ·  ") : null;

	// Optional featured image (grayscale side panel). Never block on failure.
	const imgUrl = featuredImageUrl(data.featured_image, origin);
	const imageDataUri = imgUrl ? await toGrayscaleDataUri(imgUrl) : null;

	const card: OgCardData = {
		siteTitle,
		label: LABELS[collection] ?? collection.replace(/[_-]/g, " "),
		title: rawTitle,
		excerpt,
		domain: new URL(origin).host,
		meta,
		imageDataUri,
	};

	const png = await renderOgPng(buildOgCard(card));
	const seed = `${collection}|${slug}|${siteTitle}|${rawTitle}|${excerpt ?? ""}|${meta ?? ""}|${imgUrl ?? ""}`;
	const res = pngResponse(png, seed);

	// Conditional GET: scrapers and browsers can revalidate cheaply.
	const inm = request.headers.get("if-none-match");
	const etag = res.headers.get("ETag");
	if (inm && etag && inm === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}
	return res;
};
