/**
 * Build the absolute URL of an entry's dynamic OG card.
 *
 * Kept dependency-free (no satori/sharp) so content routes can import it
 * without pulling the renderer into their bundle. The heavy renderer lives in
 * ./og-card.ts and is imported only by the card endpoint.
 */
export function buildOgImageUrl(origin: string, collection: string, slug: string): string {
	const base = origin.replace(/\/$/, "");
	return `${base}/og/${collection}/${encodeURIComponent(slug)}.png`;
}
