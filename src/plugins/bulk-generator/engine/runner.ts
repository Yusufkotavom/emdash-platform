import { substituteTokens, slugify, deepSubstituteTokens } from "./tokens.js";
import { markdownToPortableText } from "./portable-text.js";
import type { PluginContext } from "emdash";

export const PAGE_BLOCK_PRESETS: Record<string, string> = {
  landing_page: JSON.stringify(
    [
      {
        _type: "marketing_hero",
        _version: "1.0.0",
        _key: "hero_preset",
        headline: "Jasa {{layanan}} Terbaik di {{kabupaten}}",
        subheadline: "Layanan {{layanan}} profesional dan terpercaya di wilayah {{kabupaten}}, {{provinsi}}.",
        cta_label: "Konsultasi Sekarang",
        cta_url: "https://wa.me/6285799520350?text=Halo%20saya%20tertarik%20{{layanan}}%20di%20{{kabupaten}}",
        centered: true,
      },
      {
        _type: "marketing_split",
        _version: "1.0.0",
        _key: "split_preset",
        headline: "Solusi Layanan No. 1 di {{kabupaten}}",
        eyebrow: "Mengapa Kami",
        body: "Kami berpengalaman menangani ratusan klien dari instansi, sekolah, dan perusahaan di {{kabupaten}}.",
        points: "Gratis ongkir ke wilayah {{kabupaten}}\nGaransi pengerjaan rapi dan cepat\nHarga langsung tangan pertama",
        cta_label: "Chat via WhatsApp",
        cta_url: "https://wa.me/6285799520350",
      },
      {
        _type: "marketing_features",
        _version: "1.0.0",
        _key: "feat_preset",
        headline: "Keunggulan Layanan Kami",
        eyebrow: "Standar Kualitas",
        features: [
          { icon: "check", title: "Kualitas Terjamin", description: "Hasil rapi dengan standar industri terbaik." },
          { icon: "clock", title: "Tepat Waktu", description: "Proses cepat sesuai deadline yang disepakati." },
          { icon: "shield", title: "Garansi Penuh", description: "Jika ada cacat kami ganti tanpa biaya." },
        ],
      },
      {
        _type: "marketing_faq",
        _version: "1.0.0",
        _key: "faq_preset",
        headline: "FAQ Seputar Layanan di {{kabupaten}}",
        subheadline: "Pertanyaan yang sering diajukan pelanggan",
        questions: [
          { question: "Berapa lama pengerjaan?", answer: "Rata-rata 3-7 hari kerja tergantung kuantitas pesanan." },
          { question: "Bisa kirim ke seluruh area {{kabupaten}}?", answer: "Bisa, kami melayani pengiriman ke seluruh kecamatan di {{kabupaten}}." },
        ],
      },
      {
        _type: "marketing_cta",
        _version: "1.0.0",
        _key: "cta_preset",
        headline: "Konsultasikan Kebutuhan Anda Sekarang",
        body: "Dapatkan penawaran harga spesial untuk pemesanan hari ini di {{kabupaten}}.",
        cta_label: "Hubungi Tim Kotacom (WA)",
        cta_url: "https://wa.me/6285799520350",
      },
    ],
    null,
    2
  ),
  simple_page: JSON.stringify(
    [
      {
        _type: "marketing_hero",
        _version: "1.0.0",
        _key: "hero_simple",
        headline: "Layanan {{layanan}} di {{kabupaten}}",
        subheadline: "Informasi lengkap mengenai layanan di wilayah {{kabupaten}}, {{provinsi}}.",
        centered: true,
      },
      {
        _type: "marketing_text",
        _version: "1.0.0",
        _key: "text_simple",
        headline: "Tentang Layanan Kami",
        body: [
          {
            _type: "block",
            _key: "b1",
            style: "normal",
            children: [{ _type: "span", _key: "s1", text: "Kami hadir di {{kabupaten}} untuk memberikan pelayanan terbaik." }],
          },
        ],
      },
    ],
    null,
    2
  ),
};

export interface TemplateRecord {
  id: string;
  name: string;
  targetCollection: "posts" | "pages";
  titlePattern: string;
  slugPattern: string;
  excerptPattern?: string;
  bodyPattern?: string; // For posts (Markdown)
  blocksJson?: string; // For pages (Blocks array with {{tokens}})
  seoTitlePattern?: string;
  seoDescPattern?: string;
  defaultStatus: "draft" | "published";
  isCollectionPage?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DatasetRecord {
  id: string;
  name: string;
  csvContent: string;
  headers: string[];
  rows: Record<string, string>[];
  createdAt: string;
  updatedAt: string;
}

export interface RunItemLog {
  rowIdx: number;
  slug: string;
  title: string;
  action: "create" | "update" | "skip" | "error";
  id?: string;
  message?: string;
}

export interface RunRecord {
  id: string;
  templateId: string;
  templateName: string;
  datasetId: string;
  datasetName: string;
  mode: "dry_run" | "skip_existing" | "update_existing" | "create_only";
  status: "completed" | "failed";
  stats: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  items: RunItemLog[];
  createdAt: string;
}

export interface RenderedContent {
  title: string;
  slug: string;
  excerpt: string;
  bodyText: string;
  seoTitle?: string;
  seoDesc?: string;
  payload: Record<string, unknown>;
}

/**
 * Render a single row against a template
 */
export function renderRow(template: TemplateRecord, row: Record<string, string>): RenderedContent {
  const title = substituteTokens(template.titlePattern, row);
  let rawSlug = substituteTokens(template.slugPattern, row);
  if (!rawSlug) {
    rawSlug = slugify(title);
  }
  const slug = slugify(rawSlug);
  const excerpt = substituteTokens(template.excerptPattern || "", row);
  const seoTitle = template.seoTitlePattern ? substituteTokens(template.seoTitlePattern, row) : undefined;
  const seoDesc = template.seoDescPattern ? substituteTokens(template.seoDescPattern, row) : undefined;

  let payload: Record<string, unknown> = {};
  let bodyText = "";

  if (template.targetCollection === "posts") {
    const rawBody = template.bodyPattern || "";
    bodyText = substituteTokens(rawBody, row);
    payload = {
      title,
      slug,
      excerpt,
      content: markdownToPortableText(bodyText),
      status: template.defaultStatus,
    };
  } else {
    // Pages collection (Blocks)
    let blocksContent: unknown[] = [];
    if (template.blocksJson && template.blocksJson.trim()) {
      try {
        const parsed = JSON.parse(template.blocksJson);
        blocksContent = deepSubstituteTokens(parsed, row);
      } catch {
        // Fallback
      }
    }

    if (!blocksContent || !Array.isArray(blocksContent) || blocksContent.length === 0) {
      const rawBody = template.bodyPattern || "";
      bodyText = substituteTokens(rawBody, row);
      blocksContent = [
        {
          _type: "marketing_hero",
          _version: "1.0.0",
          _key: "hero_" + slug.substring(0, 8),
          headline: title,
          subheadline: excerpt,
          centered: true,
        },
        {
          _type: "marketing_text",
          _version: "1.0.0",
          _key: "text_" + slug.substring(0, 8),
          headline: title,
          body: markdownToPortableText(bodyText),
        },
      ];
    } else {
      bodyText = JSON.stringify(blocksContent, null, 2);
    }

    payload = {
      title,
      slug,
      content: blocksContent,
      status: template.defaultStatus,
    };
  }

  if (seoTitle || seoDesc) {
    payload.seo = {
      title: seoTitle || title,
      description: seoDesc || excerpt,
    };
  }

  return {
    title,
    slug,
    excerpt,
    bodyText,
    seoTitle,
    seoDesc,
    payload,
  };
}

/**
 * Find existing content item by slug
 */
export async function findBySlug(
  content: NonNullable<PluginContext["content"]>,
  collection: string,
  slug: string
) {
  try {
    const listResult = await content.list(collection, { limit: 100 });
    const match = listResult.items.find(
      (item) => item.slug === slug || (item.data as Record<string, unknown>)?.slug === slug
    );
    return match || null;
  } catch {
    return null;
  }
}

/**
 * Perform dry-run over dataset
 */
export async function dryRun(
  template: TemplateRecord,
  dataset: DatasetRecord,
  content: NonNullable<PluginContext["content"]>,
  mode: "skip_existing" | "update_existing" | "create_only" = "skip_existing"
) {
  const items: RunItemLog[] = [];
  let willCreate = 0;
  let willUpdate = 0;
  let willSkip = 0;

  for (let idx = 0; idx < dataset.rows.length; idx++) {
    const row = dataset.rows[idx];
    const rendered = renderRow(template, row);
    const existing = await findBySlug(content, template.targetCollection, rendered.slug);

    if (existing) {
      if (mode === "update_existing") {
        items.push({
          rowIdx: idx + 1,
          slug: rendered.slug,
          title: rendered.title,
          action: "update",
          id: existing.id,
          message: "Will overwrite existing item",
        });
        willUpdate++;
      } else if (mode === "skip_existing") {
        items.push({
          rowIdx: idx + 1,
          slug: rendered.slug,
          title: rendered.title,
          action: "skip",
          id: existing.id,
          message: "Already exists, will skip",
        });
        willSkip++;
      } else {
        items.push({
          rowIdx: idx + 1,
          slug: rendered.slug,
          title: rendered.title,
          action: "error",
          id: existing.id,
          message: "Collision detected (create-only mode)",
        });
        willSkip++;
      }
    } else {
      items.push({
        rowIdx: idx + 1,
        slug: rendered.slug,
        title: rendered.title,
        action: "create",
        message: "New item to be created",
      });
      willCreate++;
    }
  }

  return {
    total: dataset.rows.length,
    willCreate,
    willUpdate,
    willSkip,
    items,
  };
}

/**
 * Execute real generation run
 */
export async function executeRun(
  template: TemplateRecord,
  dataset: DatasetRecord,
  content: NonNullable<PluginContext["content"]>,
  mode: "skip_existing" | "update_existing" | "create_only" = "skip_existing"
): Promise<RunRecord> {
  const runId = "run_" + Date.now();
  const items: RunItemLog[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let idx = 0; idx < dataset.rows.length; idx++) {
    const row = dataset.rows[idx];
    const rendered = renderRow(template, row);

    try {
      const existing = await findBySlug(content, template.targetCollection, rendered.slug);

      if (existing) {
        if (mode === "skip_existing") {
          skipped++;
          items.push({
            rowIdx: idx + 1,
            slug: rendered.slug,
            title: rendered.title,
            action: "skip",
            id: existing.id,
            message: "Skipped (exists)",
          });
        } else if (mode === "update_existing") {
          const updatedItem = await (content as any).update(
            template.targetCollection,
            existing.id,
            rendered.payload
          );
          updated++;
          items.push({
            rowIdx: idx + 1,
            slug: rendered.slug,
            title: rendered.title,
            action: "update",
            id: updatedItem.id,
            message: "Updated successfully",
          });
        } else {
          errors++;
          items.push({
            rowIdx: idx + 1,
            slug: rendered.slug,
            title: rendered.title,
            action: "error",
            id: existing.id,
            message: "Conflict in create-only mode",
          });
        }
      } else {
        const newItem = await (content as any).create(
          template.targetCollection,
          rendered.payload
        );
        created++;
        items.push({
          rowIdx: idx + 1,
          slug: rendered.slug,
          title: rendered.title,
          action: "create",
          id: newItem.id,
          message: "Created successfully",
        });
      }
    } catch (err: any) {
      errors++;
      items.push({
        rowIdx: idx + 1,
        slug: rendered.slug,
        title: rendered.title,
        action: "error",
        message: err?.message || "Write error",
      });
    }
  }

  const runRecord: RunRecord = {
    id: runId,
    templateId: template.id,
    templateName: template.name,
    datasetId: dataset.id,
    datasetName: dataset.name,
    mode,
    status: errors > 0 && created === 0 && updated === 0 ? "failed" : "completed",
    stats: {
      total: dataset.rows.length,
      created,
      updated,
      skipped,
      errors,
    },
    items,
    createdAt: new Date().toISOString(),
  };

  return runRecord;
}

/**
 * Bulk delete items generated in a run
 */
export async function bulkDeleteRun(
  run: RunRecord,
  template: TemplateRecord,
  content: NonNullable<PluginContext["content"]>
) {
  let deletedCount = 0;
  for (const item of run.items) {
    if (item.id && (item.action === "create" || item.action === "update")) {
      try {
        await (content as any).delete(template.targetCollection, item.id);
        deletedCount++;
      } catch {
        // continue
      }
    }
  }
  return deletedCount;
}
