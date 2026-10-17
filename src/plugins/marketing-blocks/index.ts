/**
 * Marketing blocks plugin (inline, template-local).
 *
 * Registers the marketing block types so editors can insert and edit them
 * in the admin's Portable Text editor. Block Kit `fields` describe the form
 * shown when inserting or editing a block.
 *
 * Constraints worth knowing:
 *
 * - Block Kit has no "object group" element, so nested object shapes (e.g. a
 *   CTA's { label, url }) are flattened to sibling fields like ctaLabel and
 *   ctaUrl. The site-side renderer reads the flat keys.
 * - Repeater sub-fields are scalar only: text_input, number_input, select,
 *   toggle. Nested repeaters are not allowed -- list-of-strings becomes a
 *   single multiline text field, split on newline at render time (see
 *   Pricing.astro for the pattern).
	 * - There is no media picker element in the editor's plugin-block modal yet,
	 *   so image fields are URL strings entered by hand.
 *
 * Site-side rendering is wired via componentsEntry and MarketingBlocks.astro.
 */

import { definePlugin } from "emdash";
import type { PluginDefinition } from "emdash";

const ICON_OPTIONS = [
	{ label: "Lightning", value: "zap" },
	{ label: "Shield", value: "shield" },
	{ label: "Users", value: "users" },
	{ label: "Chart", value: "chart" },
	{ label: "Code", value: "code" },
	{ label: "Globe", value: "globe" },
	{ label: "Heart", value: "heart" },
	{ label: "Star", value: "star" },
	{ label: "Check", value: "check" },
	{ label: "Lock", value: "lock" },
	{ label: "Clock", value: "clock" },
	{ label: "Cloud", value: "cloud" },
];

const CONTACT_ICON_OPTIONS = [
	{ label: "Email", value: "email" },
	{ label: "Support", value: "support" },
	{ label: "Sales", value: "sales" },
	{ label: "Phone", value: "phone" },
	{ label: "Chat", value: "chat" },
	{ label: "Location", value: "location" },
];

/**
 * Header text for a new Capabilities block. The admin pre-fills the fields with
 * it, and Capabilities.astro falls back to it when a field is absent.
 */
export const capabilitiesDefaults = {
	headline: "Build your next blog or microsite today",
	subheadline: "EmDash combines with Astro to create one end-to-end TypeScript CMS and frontend.",
};

const definition: PluginDefinition = {
	id: "marketing-blocks",
	version: "0.1.0",

	admin: {
		portableTextBlocks: [
			{
				type: "marketing.hero",
				label: "Hero",
				description: "Headline with optional links or agent actions",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{ type: "text_input", action_id: "primaryCtaLabel", label: "Primary CTA label" },
					{ type: "text_input", action_id: "primaryCtaUrl", label: "Primary CTA URL" },
					{ type: "text_input", action_id: "secondaryCtaLabel", label: "Secondary CTA label" },
					{ type: "text_input", action_id: "secondaryCtaUrl", label: "Secondary CTA URL" },
					{ type: "toggle", action_id: "showAgentActions", label: "Show agent actions instead of secondary CTA" },
					{
						type: "text_input",
						action_id: "agentPrompt",
						label: "Agent starter prompt (optional)",
						multiline: true,
					},
					{ type: "toggle", action_id: "centered", label: "Center the layout" },
				],
			},

			{
				type: "marketing.capabilities",
				label: "Capabilities",
				description: "Feature bento with illustrations",
				// Only the header is editable. Card copy lives in Capabilities.astro,
				// next to the illustration it describes.
				fields: [
					{
						type: "text_input",
						action_id: "headline",
						label: "Headline",
						initial_value: capabilitiesDefaults.headline,
					},
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Introduction",
						multiline: true,
						initial_value: capabilitiesDefaults.subheadline,
					},
				],
			},

			{
				type: "marketing.features",
				label: "Features",
				description: "Grid of feature cards with icons",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "text_input",
						action_id: "subheadline",
						label: "Subheadline",
						multiline: true,
					},
					{
						type: "repeater",
						action_id: "features",
						label: "Features",
						item_label: "Feature",
						min_items: 1,
						max_items: 12,
						fields: [
							{
								type: "select",
								action_id: "icon",
								label: "Icon",
								options: ICON_OPTIONS,
							},
							{ type: "text_input", action_id: "title", label: "Title" },
							{
								type: "text_input",
								action_id: "description",
								label: "Description",
								multiline: true,
							},
						],
					},
				],
			},

			{
				type: "marketing.testimonials",
				label: "Testimonials",
				description: "Customer testimonial cards",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "repeater",
						action_id: "testimonials",
						label: "Testimonials",
						item_label: "Testimonial",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "quote", label: "Quote", multiline: true },
							{ type: "text_input", action_id: "author", label: "Author name" },
							{ type: "text_input", action_id: "role", label: "Role / title" },
							{ type: "text_input", action_id: "company", label: "Company" },
						],
					},
				],
			},

			{
				type: "marketing.pricing",
				label: "Pricing",
				description: "Pricing plan comparison cards",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "repeater",
						action_id: "plans",
						label: "Plans",
						item_label: "Plan",
						min_items: 1,
						max_items: 6,
						fields: [
							{ type: "text_input", action_id: "name", label: "Plan name" },
							{
								type: "text_input",
								action_id: "price",
								label: "Price",
								placeholder: "$29 or Custom",
							},
							{
								type: "text_input",
								action_id: "period",
								label: "Period",
								placeholder: "/month",
							},
							{
								type: "text_input",
								action_id: "description",
								label: "Description",
								multiline: true,
							},
							{
								type: "text_input",
								action_id: "features",
								label: "Features (one per line)",
								multiline: true,
								placeholder: "Unlimited projects\nPriority support\nSSO",
							},
							{ type: "text_input", action_id: "ctaLabel", label: "CTA label" },
							{ type: "text_input", action_id: "ctaUrl", label: "CTA URL" },
							{ type: "toggle", action_id: "highlighted", label: "Highlight this plan" },
						],
					},
				],
			},

			{
				type: "marketing.faq",
				label: "FAQ",
				description: "Frequently asked questions",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "repeater",
						action_id: "items",
						label: "Questions",
						item_label: "Question",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "question", label: "Question" },
							{
								type: "text_input",
								action_id: "answer",
								label: "Answer",
								multiline: true,
							},
						],
					},
				],
			},
			{
				type: "marketing.cta",
				label: "Call to Action",
				description: "Call to action banner",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{ type: "text_input", action_id: "body", label: "Body text", multiline: true },
					{ type: "text_input", action_id: "primaryCtaLabel", label: "Primary CTA label" },
					{ type: "text_input", action_id: "primaryCtaUrl", label: "Primary CTA URL" },
					{ type: "text_input", action_id: "secondaryCtaLabel", label: "Secondary CTA label" },
					{ type: "text_input", action_id: "secondaryCtaUrl", label: "Secondary CTA URL" },
				],
			},
			{
				type: "marketing.logos",
				label: "Logos",
				description: "Logo marquee track",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{
						type: "repeater",
						action_id: "logos",
						label: "Logos",
						item_label: "Logo",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "name", label: "Brand name" },
						],
					},
				],
			},
			{
				type: "marketing.split",
				label: "Split Content",
				description: "Two-column feature with highlights and CTA",
				fields: [
					{ type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{ type: "text_input", action_id: "body", label: "Body text", multiline: true },
					{
						type: "text_input",
						action_id: "points",
						label: "Bullet points (one per line)",
						multiline: true,
					},
					{ type: "text_input", action_id: "ctaLabel", label: "CTA label" },
					{ type: "text_input", action_id: "ctaUrl", label: "CTA URL" },
					{ type: "toggle", action_id: "imageFirst", label: "Show media first" },
				],
			},
			{
				type: "marketing.stats",
				label: "Stats",
				description: "Key metrics and statistics",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{ type: "text_input", action_id: "subheadline", label: "Subheadline" },
					{
						type: "repeater",
						action_id: "stats",
						label: "Statistics",
						item_label: "Stat",
						min_items: 1,
						fields: [
							{ type: "text_input", action_id: "label", label: "Label" },
							{ type: "text_input", action_id: "value", label: "Value (e.g. 99.9% or 10M+)" },
						],
					},
				],
			},
			{
				type: "marketing.contact",
				label: "Contact",
				description: "Contact channels and options",
				fields: [
					{ type: "text_input", action_id: "eyebrow", label: "Eyebrow" },
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{ type: "text_input", action_id: "subheadline", label: "Subheadline", multiline: true },
					{
						type: "repeater",
						action_id: "options",
						label: "Contact options",
						item_label: "Option",
						min_items: 1,
						fields: [
							{
								type: "select",
								action_id: "icon",
								label: "Icon",
								options: CONTACT_ICON_OPTIONS,
							},
							{ type: "text_input", action_id: "title", label: "Title" },
							{ type: "text_input", action_id: "description", label: "Description", multiline: true },
							{ type: "text_input", action_id: "linkLabel", label: "Link label" },
							{ type: "text_input", action_id: "linkUrl", label: "Link URL" },
						],
					},
				],
			},
			{
				type: "marketing.text",
				label: "Text",
				description: "Narrative text section",
				fields: [
					{ type: "text_input", action_id: "headline", label: "Headline" },
					{ type: "text_input", action_id: "body", label: "Body text", multiline: true },
				],
			},
		],
	},
};

/** The registered blocks, in slash-menu order. The capabilities illustration lists them. */
export const portableTextBlocks = definition.admin?.portableTextBlocks ?? [];

export function createPlugin() {
	return definePlugin(definition);
}

export default createPlugin;
