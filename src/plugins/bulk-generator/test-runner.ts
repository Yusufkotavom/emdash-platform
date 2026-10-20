import assert from "node:assert";
import { parseCsv } from "./engine/csv.js";
import { substituteTokens, slugify, deepSubstituteTokens } from "./engine/tokens.js";
import { markdownToPortableText } from "./engine/portable-text.js";
import { renderRow, PAGE_BLOCK_PRESETS, type TemplateRecord } from "./engine/runner.js";

console.log("=== 1. Testing CSV Parser ===");
const sampleCsv = `kabupaten,kabupaten_slug,provinsi,ongkir
Bandung,bandung,Jawa Barat,Gratis
Bogor,bogor,Jawa Barat,"Rp 10,000"
Bekasi,bekasi,Jawa Barat,Rp 12.000`;

const parsed = parseCsv(sampleCsv);
assert.strictEqual(parsed.headers.length, 4);
assert.strictEqual(parsed.rows.length, 3);
assert.strictEqual(parsed.rows[0].kabupaten, "Bandung");
assert.strictEqual(parsed.rows[1].ongkir, "Rp 10,000");
console.log("✓ CSV parser passed!");

console.log("=== 2. Testing Token Engine & Deep Substitutions ===");
const tplStr = "Jasa Cetak di {{kabupaten}} ({{kabupaten | slug}}) - {{provinsi | upper}}";
const row = { kabupaten: "Bandung Barat", provinsi: "Jawa Barat", layanan: "Cetak Buku" };
const replaced = substituteTokens(tplStr, row);
assert.strictEqual(replaced, "Jasa Cetak di Bandung Barat (bandung-barat) - JAWA BARAT");
assert.strictEqual(slugify("Jasa Cetak Buku Murah @ Kotacom!"), "jasa-cetak-buku-murah-kotacom");

// Deep substitution test on nested objects & arrays
const nestedObj = {
  hero: {
    headline: "Layanan {{layanan}} di {{kabupaten}}",
    items: [
      { text: "Wilayah {{provinsi}}", _key: "old_key" },
    ],
  },
};
const deepSub = deepSubstituteTokens(nestedObj, row);
assert.strictEqual(deepSub.hero.headline, "Layanan Cetak Buku di Bandung Barat");
assert.strictEqual(deepSub.hero.items[0].text, "Wilayah Jawa Barat");
assert.notStrictEqual(deepSub.hero.items[0]._key, "old_key"); // regenerated key!
console.log("✓ Deep token engine passed!");

console.log("=== 3. Testing Portable Text Conversion ===");
const md = `# Judul Utama
Layanan terbaik di kota Anda.

## Keunggulan
- Cepat
- Murah
- Bergaransi`;

const ptBlocks = markdownToPortableText(md);
assert.strictEqual(ptBlocks.length, 6);
assert.strictEqual(ptBlocks[0].style, "h1");
assert.strictEqual(ptBlocks[0].children[0].text, "Judul Utama");
assert.strictEqual(ptBlocks[1].style, "normal");
assert.strictEqual(ptBlocks[2].style, "h2");
assert.strictEqual(ptBlocks[3].listItem, "bullet");
assert.strictEqual(ptBlocks[3].children[0].text, "Cepat");
console.log("✓ Portable Text converter passed!");

console.log("=== 4. Testing Post Template (Markdown / Portable Text) ===");
const postTemplate: TemplateRecord = {
  id: "tpl_post",
  name: "Cetak Buku Jabar Post",
  targetCollection: "posts",
  titlePattern: "Jasa Cetak Buku di {{kabupaten}}",
  slugPattern: "jasa-cetak-buku-{{kabupaten | slug}}",
  excerptPattern: "Pusat cetak buku di {{kabupaten}}, {{provinsi}}.",
  bodyPattern: "# Percetakan {{kabupaten}}\n\nMelayani cetak buku di {{kabupaten}} ongkir {{ongkir}}.",
  seoTitlePattern: "{{kabupaten}} | Cetak Buku",
  seoDescPattern: "Cetak buku murah di {{kabupaten}}",
  defaultStatus: "published",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const renderedPost = renderRow(postTemplate, parsed.rows[0]);
assert.strictEqual(renderedPost.title, "Jasa Cetak Buku di Bandung");
// The plugin content API cannot set a slug; EmDash derives it from the title.
assert.strictEqual(renderedPost.slug, "jasa-cetak-buku-di-bandung");
assert.strictEqual(renderedPost.excerpt, "Pusat cetak buku di Bandung, Jawa Barat.");
// slug/status are rejected as unknown fields on create, so they must be absent.
assert.strictEqual((renderedPost.payload as any).slug, undefined);
assert.strictEqual((renderedPost.payload as any).status, undefined);
assert.strictEqual((renderedPost.payload as any).excerpt, "Pusat cetak buku di Bandung, Jawa Barat.");
assert.strictEqual(renderedPost.seoTitle, "Bandung | Cetak Buku");
assert.ok(Array.isArray((renderedPost.payload as any).content));
console.log("✓ Post template rendering passed!");

console.log("=== 5. Testing Page Template (Marketing Blocks) ===");
const pageTemplate: TemplateRecord = {
  id: "tpl_page",
  name: "Landing Page Layanan Kabupaten",
  targetCollection: "pages",
  titlePattern: "Jasa {{layanan}} di {{kabupaten}}",
  slugPattern: "jasa-{{layanan | slug}}-{{kabupaten | slug}}",
  excerptPattern: "Layanan {{layanan}} profesional di {{kabupaten}}, {{provinsi}}.",
  blocksJson: PAGE_BLOCK_PRESETS.landing_page,
  defaultStatus: "published",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const renderedPage = renderRow(pageTemplate, { ...parsed.rows[0], layanan: "Cetak Majalah" });
assert.strictEqual(renderedPage.title, "Jasa Cetak Majalah di Bandung");
// Auto-slug from the title (slug_pattern no longer drives the URL).
assert.strictEqual(renderedPage.slug, "jasa-cetak-majalah-di-bandung");
assert.strictEqual((renderedPage.payload as any).slug, undefined);
assert.strictEqual((renderedPage.payload as any).status, undefined);
const blocks = (renderedPage.payload as any).content;
assert.ok(Array.isArray(blocks));
assert.strictEqual(blocks.length, 5);
assert.strictEqual(blocks[0]._type, "marketing_hero");
assert.strictEqual(blocks[0].headline, "Jasa Cetak Majalah Terbaik di Bandung");
assert.strictEqual(blocks[1]._type, "marketing_split");
assert.strictEqual(blocks[1].headline, "Solusi Layanan No. 1 di Bandung");
assert.strictEqual(blocks[2]._type, "marketing_features");
assert.strictEqual(blocks[3]._type, "marketing_faq");
assert.strictEqual(blocks[4]._type, "marketing_cta");
assert.strictEqual(blocks[4].headline, "Konsultasikan Kebutuhan Anda Sekarang");
console.log("✓ Page template with Marketing Blocks passed!");

console.log("\nALL TESTS PASSED 100%!");
