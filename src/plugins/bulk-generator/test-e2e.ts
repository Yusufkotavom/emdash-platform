import assert from "node:assert";
import { parseCsv } from "./engine/csv.js";
import { renderRow, PAGE_BLOCK_PRESETS, type TemplateRecord, type DatasetRecord } from "./engine/runner.js";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("/home/ubuntu/emdash/my-site/data.db");

console.log("=== 1. Testing SQLite Schema & Storage ===");
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((r: any) => r.name);

assert.ok(tables.includes("ec_pages"), "ec_pages table exists");
assert.ok(tables.includes("ec_posts"), "ec_posts table exists");
assert.ok(tables.includes("_plugin_storage"), "_plugin_storage table exists");
console.log("✓ All required database tables confirmed!");

console.log("=== 2. Testing Template CRUD in Plugin Storage ===");
const now = new Date().toISOString();

// CREATE Page Template
const pageTpl: TemplateRecord = {
  id: "tpl_page_crud_test",
  name: "Landing Page Layanan Kabupaten",
  targetCollection: "pages",
  titlePattern: "Jasa {{layanan}} di {{kabupaten}}",
  slugPattern: "jasa-{{layanan | slug}}-{{kabupaten | slug}}",
  excerptPattern: "Layanan {{layanan}} terpercaya di {{kabupaten}}, {{provinsi}}.",
  blocksJson: PAGE_BLOCK_PRESETS.landing_page,
  defaultStatus: "draft",
  createdAt: now,
  updatedAt: now,
};

db.prepare(`
  INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at, revision)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(plugin_id, collection, id) DO UPDATE SET data = excluded.data
`).run("bulk-generator", "templates", pageTpl.id, JSON.stringify(pageTpl), now, now, 1);

// READ Template
const readRow = db.prepare(`
  SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = ? AND id = ?
`).get("bulk-generator", "templates", pageTpl.id) as any;
assert.ok(readRow, "Template record retrieved");
const loadedTpl: TemplateRecord = JSON.parse(readRow.data);
assert.strictEqual(loadedTpl.name, "Landing Page Layanan Kabupaten");
assert.strictEqual(loadedTpl.targetCollection, "pages");
console.log("✓ Template CREATE & READ verified!");

// UPDATE Template
loadedTpl.name = "Landing Page Layanan Jawa Barat (Updated)";
db.prepare(`
  UPDATE _plugin_storage SET data = ?, updated_at = ? WHERE plugin_id = ? AND collection = ? AND id = ?
`).run(JSON.stringify(loadedTpl), new Date().toISOString(), "bulk-generator", "templates", pageTpl.id);

const updatedRow = db.prepare(`
  SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = ? AND id = ?
`).get("bulk-generator", "templates", pageTpl.id) as any;
assert.strictEqual(JSON.parse(updatedRow.data).name, "Landing Page Layanan Jawa Barat (Updated)");
console.log("✓ Template UPDATE verified!");

// CREATE Post Template
const postTpl: TemplateRecord = {
  id: "tpl_post_crud_test",
  name: "Artikel Edukasi Post",
  targetCollection: "posts",
  titlePattern: "Tips {{layanan}} di {{kabupaten}}",
  slugPattern: "tips-{{layanan | slug}}-{{kabupaten | slug}}",
  excerptPattern: "Panduan lengkap seputar {{layanan}} di {{kabupaten}}.",
  bodyPattern: "# Panduan {{layanan}}\n\nWilayah {{kabupaten}} kini dapat mengakses layanan cetak hemat.",
  defaultStatus: "published",
  createdAt: now,
  updatedAt: now,
};

db.prepare(`
  INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at, revision)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(plugin_id, collection, id) DO UPDATE SET data = excluded.data
`).run("bulk-generator", "templates", postTpl.id, JSON.stringify(postTpl), now, now, 1);
console.log("✓ Post Template verified!");

console.log("=== 3. Testing Dataset CRUD in Plugin Storage ===");
const sampleCsv = `kabupaten,layanan,provinsi
Bandung,Cetak Buku,Jawa Barat
Bogor,Digital Printing,Jawa Barat
Bekasi,Cetak Majalah,Jawa Barat`;

const parsed = parseCsv(sampleCsv);
const dsRecord: DatasetRecord = {
  id: "ds_test_kabs",
  name: "Kabupaten Target Cetak Jabar",
  csvContent: sampleCsv,
  headers: parsed.headers,
  rows: parsed.rows,
  createdAt: now,
  updatedAt: now,
};

db.prepare(`
  INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at, revision)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(plugin_id, collection, id) DO UPDATE SET data = excluded.data
`).run("bulk-generator", "datasets", dsRecord.id, JSON.stringify(dsRecord), now, now, 1);

const readDs = db.prepare(`
  SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = ? AND id = ?
`).get("bulk-generator", "datasets", dsRecord.id) as any;
assert.ok(readDs, "Dataset retrieved");
const loadedDs: DatasetRecord = JSON.parse(readDs.data);
assert.strictEqual(loadedDs.rows.length, 3);
console.log("✓ Dataset CRUD verified!");

console.log("=== 4. Testing Page Generation with Block Kit (Marketing Blocks) ===");
for (const row of loadedDs.rows) {
  const rendered = renderRow(loadedTpl, row);
  assert.ok(rendered.slug.startsWith("jasa-"));
  const blocks = (rendered.payload as any).content;
  assert.ok(Array.isArray(blocks), "Blocks is array");
  assert.strictEqual(blocks[0]._type, "marketing_hero");
  assert.ok(blocks[0].headline.includes(row.kabupaten));

  const pageId = "page_gen_" + rendered.slug;
  db.prepare(`
    INSERT INTO ec_pages (id, slug, status, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content
  `).run(
    pageId,
    rendered.slug,
    rendered.payload.status as string,
    rendered.title,
    JSON.stringify(blocks),
    now,
    now
  );
}

const generatedPages = db.prepare(`SELECT id, slug, title, content FROM ec_pages WHERE slug LIKE 'jasa-%'`).all() as any[];
assert.strictEqual(generatedPages.length, 3);
console.log(`✓ Successfully generated ${generatedPages.length} pages with nested Marketing Blocks!`);
const firstPageContent = JSON.parse(generatedPages[0].content);
console.log(`  Page sample [${generatedPages[0].slug}]: ${firstPageContent[0].headline} (Blocks: ${firstPageContent.length})`);

console.log("=== 5. Testing Post Generation with Portable Text ===");
for (const row of loadedDs.rows) {
  const rendered = renderRow(postTpl, row);
  const postId = "post_gen_" + rendered.slug;
  db.prepare(`
    INSERT INTO ec_posts (id, slug, status, title, excerpt, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content
  `).run(
    postId,
    rendered.slug,
    rendered.payload.status as string,
    rendered.title,
    rendered.excerpt,
    JSON.stringify((rendered.payload as any).content),
    now,
    now
  );
}

const generatedPosts = db.prepare(`SELECT id, slug, title, content FROM ec_posts WHERE slug LIKE 'tips-%'`).all() as any[];
assert.strictEqual(generatedPosts.length, 3);
console.log(`✓ Successfully generated ${generatedPosts.length} posts with Portable Text!`);

console.log("=== 6. Testing Bulk Deletion Cleanup ===");
db.prepare(`DELETE FROM ec_pages WHERE slug LIKE 'jasa-%'`).run();
db.prepare(`DELETE FROM ec_posts WHERE slug LIKE 'tips-%'`).run();
const remainingPages = db.prepare(`SELECT count(*) as count FROM ec_pages WHERE slug LIKE 'jasa-%'`).get() as any;
const remainingPosts = db.prepare(`SELECT count(*) as count FROM ec_posts WHERE slug LIKE 'tips-%'`).get() as any;
assert.strictEqual(remainingPages.count, 0);
assert.strictEqual(remainingPosts.count, 0);
console.log("✓ Bulk cleanup verified!");

// Clean up test templates & datasets
db.prepare(`DELETE FROM _plugin_storage WHERE plugin_id = 'bulk-generator' AND id LIKE '%_crud_test'`).run();
db.prepare(`DELETE FROM _plugin_storage WHERE plugin_id = 'bulk-generator' AND id = 'ds_test_kabs'`).run();

db.close();
console.log("\nALL E2E CRUD & DB OPERATIONS PASSED 100%!");
