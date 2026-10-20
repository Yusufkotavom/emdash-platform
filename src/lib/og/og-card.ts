/**
 * Dynamic Open Graph card renderer.
 *
 * Renders a branded 1200x630 social card from an entry's title/excerpt using
 * satori (HTML/CSS -> SVG) + sharp (SVG -> PNG). The layout mirrors the site's
 * "frame rails" theme (src/styles/tokens.css): a #fafafa canvas, #171717 ink,
 * Inter for display text, JetBrains Mono for uppercase micro labels, full-height
 * hairline rails, crosshairs where a rule meets a rail, and the black brand mark
 * from the header. A faint monogram watermark fills the right side; when the
 * entry has a featured image, a grayscale photo panel replaces the watermark
 * (the site renders photographic media in monochrome).
 *
 * Fonts are bundled under assets/fonts and read once, then cached in module
 * scope so repeated requests never touch disk again.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import sharp from "sharp";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// ---- theme palette (light mode, mirrors tokens.css :root.light) ----
const C = {
	canvas: "#fafafa",
	ink: "#171717",
	textSecondary: "#525252",
	muted: "#6b6b6b",
	border: "#e5e5e5",
	watermark: "#ededed",
	onBrand: "#ffffff",
};

// ---- layout constants ----
const PAD = 72; // frame padding (rail -> content)
const RAIL_INSET = 30; // rail distance from the outer edge
const IMAGE_PANEL_W = 452; // right photo panel width when an image is present

interface LoadedFont {
	name: string;
	data: Buffer;
	weight: 400 | 500 | 600 | 700;
	style: "normal";
}

let cachedFonts: LoadedFont[] | null = null;

function fontPath(file: string): string {
	// Dev: cwd is the project root. Docker: cwd is /app (assets copied there).
	return join(process.cwd(), "assets", "fonts", file);
}

function loadFonts(): LoadedFont[] {
	if (cachedFonts) return cachedFonts;
	const read = (f: string) => readFileSync(fontPath(f));
	cachedFonts = [
		{ name: "Inter", data: read("inter-400.woff"), weight: 400, style: "normal" },
		{ name: "Inter", data: read("inter-600.woff"), weight: 600, style: "normal" },
		{ name: "Inter", data: read("inter-700.woff"), weight: 700, style: "normal" },
		{ name: "JetBrains Mono", data: read("jetbrains-mono-500.woff"), weight: 500, style: "normal" },
		{ name: "JetBrains Mono", data: read("jetbrains-mono-700.woff"), weight: 700, style: "normal" },
	];
	return cachedFonts;
}

// satori's element shape (a subset of react-style nodes).
type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };

/** Monogram shown in the black brand square, matching .brand__mark in Base.astro. */
function monogramOf(siteTitle: string): string {
	return [...siteTitle.trim()][0]?.toUpperCase() ?? "";
}

/** Pick a display size that keeps the title to <= 3 lines without leaving the box. */
function titleSizeFor(len: number): number {
	if (len <= 34) return 80;
	if (len <= 62) return 66;
	if (len <= 96) return 54;
	if (len <= 140) return 45;
	return 38;
}

export interface OgCardData {
	siteTitle: string;
	/** Uppercase micro-label, e.g. "ARTIKEL" or a tag name. */
	label: string;
	title: string;
	excerpt?: string | null;
	/** Canonical host, e.g. "emdash.devk.my.id". */
	domain: string;
	/** Small mono string bottom-right, e.g. "Okt 2026 · 3 menit baca". */
	meta?: string | null;
	/** Optional pre-processed (grayscale) featured image, as a data URI. */
	imageDataUri?: string | null;
}

function el(style: Record<string, unknown>, children: unknown): Node {
	return { type: "div", props: { style: { display: "flex", ...style }, children } };
}

function text(style: Record<string, unknown>, content: string): Node {
	return { type: "div", props: { style: { display: "flex", ...style }, children: content } };
}

function brandMark(siteTitle: string): Node {
	return el(
		{
			alignItems: "center",
			justifyContent: "center",
			width: "46px",
			height: "46px",
			borderRadius: "9px",
			background: C.ink,
			color: C.onBrand,
			fontSize: "25px",
			fontWeight: 700,
			letterSpacing: "0",
			flexShrink: 0,
		},
		monogramOf(siteTitle),
	);
}

function microLabel(label: string, extra?: Record<string, unknown>): Node {
	return text(
		{
			fontFamily: "JetBrains Mono",
			fontWeight: 500,
			fontSize: "17px",
			letterSpacing: "0.18em",
			textTransform: "uppercase",
			color: C.muted,
			...(extra ?? {}),
		},
		label,
	);
}

/** Full-height vertical hairline rail — the theme's signature frame edge. */
function rail(left: number): Node {
	return {
		type: "div",
		props: {
			style: {
				display: "flex",
				position: "absolute",
				top: 0,
				left: `${left}px`,
				width: "1px",
				height: `${OG_HEIGHT}px`,
				background: C.border,
			},
		},
	};
}

/** Small "+" crosshair where a rule crosses a rail (a theme motif). */
function crosshair(x: number, y: number, size = 13): Node {
	return {
		type: "div",
		props: {
			style: {
				display: "flex",
				position: "absolute",
				top: `${y}px`,
				left: `${x}px`,
				width: `${size}px`,
				height: `${size}px`,
				alignItems: "center",
				justifyContent: "center",
			},
			children: [
				{ type: "div", props: { style: { display: "flex", position: "absolute", width: `${size}px`, height: "1px", background: C.border } } },
				{ type: "div", props: { style: { display: "flex", position: "absolute", width: "1px", height: `${size}px`, background: C.border } } },
			],
		},
	};
}

/** Request-time background layer: watermark monogram (or grayscale photo panel). */
function background(siteTitle: string, imageDataUri?: string | null): Node {
	if (imageDataUri) {
		return el(
			{
				position: "absolute",
				top: 0,
				right: 0,
				width: `${IMAGE_PANEL_W}px`,
				height: `${OG_HEIGHT}px`,
				overflow: "hidden",
				borderLeft: `1px solid ${C.border}`,
			},
			{
				type: "img",
				props: {
					src: imageDataUri,
					width: IMAGE_PANEL_W,
					height: OG_HEIGHT,
					style: { objectFit: "cover" },
				},
			} as unknown as Node,
		);
	}
	return text(
		{
			position: "absolute",
			right: `${PAD - 18}px`,
			top: "-128px",
			fontSize: "640px",
			fontWeight: 700,
			letterSpacing: "-0.05em",
			color: C.watermark,
			lineHeight: 1,
		},
		monogramOf(siteTitle),
	);
}

export function buildOgCard(data: OgCardData): Node {
	const { siteTitle, label, title, excerpt, domain, meta, imageDataUri } = data;
	const hasImage = Boolean(imageDataUri);
	const contentW = OG_WIDTH - PAD * 2 - (hasImage ? IMAGE_PANEL_W : 0);
	const tSize = titleSizeFor(title.trim().length);

	const header: Node = el(
		{ alignItems: "center", justifyContent: "space-between", width: "100%" },
		[
			el({ alignItems: "center", gap: "15px", minWidth: 0 }, [
				brandMark(siteTitle),
				text(
					{
						fontSize: "23px",
						fontWeight: 600,
						letterSpacing: "-0.02em",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						color: C.ink,
					},
					siteTitle.trim(),
				),
			]),
			microLabel(label, { flexShrink: 0 }),
		],
	);

	const body: Node = el(
		{ flexDirection: "column", justifyContent: "center", flex: 1, gap: "24px", maxWidth: `${contentW}px` },
		[
			text(
				{
					fontSize: `${tSize}px`,
					fontWeight: 700,
					lineHeight: 1.07,
					letterSpacing: "-0.035em",
					color: C.ink,
					lineClamp: 3,
					overflow: "hidden",
				},
				title,
			),
			excerpt && excerpt.trim()
				? text(
						{
							fontSize: "24px",
							fontWeight: 400,
							color: C.textSecondary,
							lineHeight: 1.45,
							lineClamp: 2,
							overflow: "hidden",
						},
						excerpt.trim(),
					)
				: null,
		].filter(Boolean) as Node[],
	);

	const footerRuleY = OG_HEIGHT - PAD - 34;
	const footer: Node = el(
		{ flexDirection: "column", gap: "20px", width: `${contentW}px` },
		[
			el({ width: "100%", height: "1px", background: C.border }, ""),
			el({ alignItems: "center", justifyContent: "space-between", width: "100%" }, [
				text(
					{ fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: "17px", color: C.muted, letterSpacing: "0.03em" },
					domain,
				),
				meta
					? text(
							{ fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: "17px", color: C.muted, letterSpacing: "0.03em" },
							meta,
						)
					: el({}, ""),
			]),
		],
	);

	const textColumn: Node = el(
		{
			flexDirection: "column",
			justifyContent: "space-between",
			flex: 1,
			width: `${contentW}px`,
			height: "100%",
			padding: `${PAD}px 0`,
			position: "relative",
		},
		[header, body, footer],
	);

	const layers = [
		background(siteTitle, imageDataUri),
		rail(RAIL_INSET),
		rail(OG_WIDTH - RAIL_INSET),
		// Crosshairs where the footer rule meets each rail.
		crosshair(RAIL_INSET - 6, footerRuleY - 6),
		crosshair(OG_WIDTH - RAIL_INSET - 6, footerRuleY - 6),
		el({ width: "100%", height: "100%" }, textColumn),
	];

	return {
		type: "div",
		props: {
			style: {
				display: "flex",
				position: "relative",
				width: `${OG_WIDTH}px`,
				height: `${OG_HEIGHT}px`,
				background: C.canvas,
				color: C.ink,
				fontFamily: "Inter",
				padding: `0 ${PAD}px`,
			},
			children: layers,
		},
	};
}

// ---- optional featured-image fetch (grayscale, cached) ----
const imageCache = new Map<string, string | null>();

/** Fetch a remote image, convert to grayscale + cover-crop for the panel. */
export async function toGrayscaleDataUri(url: string, timeoutMs = 4000): Promise<string | null> {
	const cached = imageCache.get(url);
	if (cached !== undefined) return cached;
	try {
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), timeoutMs);
		const res = await fetch(url, { signal: ctrl.signal });
		clearTimeout(t);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		const out = await sharp(buf)
			.resize(IMAGE_PANEL_W, OG_HEIGHT, { fit: "cover", position: "attention" })
			.grayscale()
			.png({ compressionLevel: 6 })
			.toBuffer();
		const uri = `data:image/png;base64,${out.toString("base64")}`;
		imageCache.set(url, uri);
		return uri;
	} catch {
		imageCache.set(url, null);
		return null;
	}
}

/** Render a card node to a PNG buffer. */
export async function renderOgPng(node: Node): Promise<Buffer> {
	const svg = await satori(node as never, {
		width: OG_WIDTH,
		height: OG_HEIGHT,
		fonts: loadFonts() as never,
	});
	return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
