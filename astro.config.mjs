import node from "@astrojs/node";
import react from "@astrojs/react";
import icon from "astro-iconset";
import { defineConfig, fontProviders } from "astro/config";
import emdash, { local } from "emdash/astro";
import { postgres } from "emdash/db";

const uploadsDirectory = process.env.UPLOADS_DIR || "./uploads";

export default defineConfig({
	site: process.env.EMDASH_SITE_URL || "https://emdash.devk.my.id",
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		icon({
			// Only ship the Phosphor icons actually referenced in templates,
			// not the full @iconify-json/ph set.
			include: {
				ph: [
					"arrow-right",
					"bell-simple",
					"buildings",
					"chart-bar",
					"chat-circle",
					"check",
					"check-circle",
					"clock",
					"cloud",
					"code",
					"currency-dollar",
					"envelope",
					"file-text",
					"gauge",
					"globe",
					"heart",
					"leaf",
					"lifebuoy",
					"lightning",
					"list",
					"lock",
					"map-pin",
					"pause",
					"phone",
					"play",
					"plug",
					"plus",
					"shield-check",
					"sparkle",
					"star",
					"sun",
					"thermometer-simple",
					"trend-up",
					"users-three",
					"x",
				],
			},
		}),
		emdash({
			siteUrl: process.env.EMDASH_SITE_URL || "https://emdash.devk.my.id",
			database: postgres({
				connectionString: process.env.DATABASE_URL,
			}),
			storage: local({
				directory: uploadsDirectory,
				baseUrl: "/_emdash/api/media/file",
			}),
			plugins: [
				{
					id: "bulk-generator",
					version: "1.0.0",
					entrypoint: new URL("./src/plugins/bulk-generator/index.ts", import.meta.url).pathname,
					adminPages: [
						{ path: "/generator", label: "Bulk Generator", icon: "sparkle" },
					],
					capabilities: ["content:read", "content:write", "content:publish"],
				},
				{
					id: "marketing-blocks",
					version: "0.1.0",
					entrypoint: new URL("./src/plugins/marketing-blocks/index.ts", import.meta.url).pathname,
				},
			],
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-body",
			weights: [400, 500, 600, 700],
			fallbacks: ["sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "Instrument Serif",
			cssVariable: "--font-display",
			weights: [400],
			styles: ["normal", "italic"],
			fallbacks: ["serif"],
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-mono",
			weights: [400, 500],
			fallbacks: ["monospace"],
		},
	],
	devToolbar: { enabled: false },
});
