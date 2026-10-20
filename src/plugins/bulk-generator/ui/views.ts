import { blocks, elements, type Block, type FormField } from "@emdash-cms/blocks";
import {
  type TemplateRecord,
  type DatasetRecord,
  type RunRecord,
  type RenderedContent,
  type RunItemLog,
  PAGE_BLOCK_PRESETS,
} from "../engine/runner.js";

export interface ViewState {
  activeTab: "templates" | "datasets" | "preview" | "generate" | "history";
  editingTemplateId?: string;
  editingDatasetId?: string;
  selectedTemplateId?: string;
  selectedDatasetId?: string;
  previewResult?: RenderedContent;
  dryRunResult?: {
    total: number;
    willCreate: number;
    willUpdate: number;
    willSkip: number;
    items: RunItemLog[];
  };
  lastRunResult?: RunRecord;
}

export function renderPluginUi(
  state: ViewState,
  templates: TemplateRecord[],
  datasets: DatasetRecord[],
  runs: RunRecord[]
): Block[] {
  const result: Block[] = [];

  // Header & Navigation
  result.push(blocks.header("Bulk Content Generator"));
  result.push(
    blocks.section(
      "Programmatic SEO & Content Generation Engine for EmDash CMS. Native page block templates (Marketing Blocks) and post templates (Portable Text) with full CRUD and CSV token datasets."
    )
  );

  result.push(
    blocks.actions([
      elements.button("tab_templates", "Templates (" + templates.length + ")", {
        style: state.activeTab === "templates" ? "primary" : "secondary",
      }),
      elements.button("tab_datasets", "Datasets (" + datasets.length + ")", {
        style: state.activeTab === "datasets" ? "primary" : "secondary",
      }),
      elements.button("tab_preview", "Preview & Dry Run", {
        style: state.activeTab === "preview" ? "primary" : "secondary",
      }),
      elements.button("tab_generate", "Generate", {
        style: state.activeTab === "generate" ? "primary" : "secondary",
      }),
      elements.button("tab_history", "Runs & Delete (" + runs.length + ")", {
        style: state.activeTab === "history" ? "primary" : "secondary",
      }),
    ])
  );

  result.push(blocks.divider());

  // ==========================================
  // TAB: TEMPLATES (CRUD)
  // ==========================================
  if (state.activeTab === "templates") {
    const editingTpl = state.editingTemplateId
      ? templates.find((t) => t.id === state.editingTemplateId)
      : undefined;

    result.push(
      blocks.section(
        "✨ **Templates adalah Native Custom Post Type Pages!**\n\nTemplate sekarang dibuat dan diedit persis seperti membuat **Page** biasa. Anda dapat menggunakan **EmDash Visual Block Editor** di menu sidebar **Page Templates** (`/_emdash/admin/content/page_templates`) untuk menambah, menyusun, dan mengedit blok secara visual (Hero, Split, Features, FAQ, CTA) dengan placeholder token `{{token}}`."
      )
    );

    if (templates.length > 0) {
      result.push(blocks.section("### 📑 Saved Page Templates"));
      const rows = templates.map((t) => ({
        name: t.name,
        type: t.isCollectionPage ? "PAGE (Visual Builder)" : (t.targetCollection === "pages" ? "PAGE (Blocks)" : "POST"),
        slug_pattern: t.slugPattern,
        status: t.defaultStatus.toUpperCase(),
        id: t.id,
      }));

      result.push(
        blocks.table({
          columns: [
            { key: "name", label: "Template Name" },
            { key: "type", label: "Structure Type" },
            { key: "slug_pattern", label: "Slug Pattern" },
            { key: "status", label: "Default Status" },
            { key: "id", label: "Template ID" },
          ],
          rows,
          pageActionId: "page_templates",
          emptyText: "No templates saved.",
        })
      );

      // Template Selection & Quick Action Controls
      const tplOptions = templates.map((t) => ({
        label: `${t.name} [${t.targetCollection.toUpperCase()}]`,
        value: t.id,
      }));

      result.push(blocks.section("#### Manage Selected Template"));
      result.push(
        blocks.form({
          fields: [
            elements.select("manage_template_id", "Select Template to Edit / Delete", tplOptions, {
              initialValue: editingTpl?.id || state.selectedTemplateId || tplOptions[0].value,
            }),
          ],
          submit: {
            label: "Edit Selected Template",
            actionId: "load_edit_template",
          },
        })
      );

      result.push(
        blocks.actions([
          elements.button("action_delete_template", "Delete Selected Template", {
            style: "danger",
            confirm: {
              title: "Delete Template?",
              text: "Are you sure you want to permanently delete this template definition?",
              confirm: "Delete",
              deny: "Cancel",
            },
          }),
          elements.button("action_duplicate_template", "Duplicate Template", {
            style: "secondary",
          }),
        ])
      );

      result.push(blocks.divider());
    }

    // FORM: CREATE OR UPDATE TEMPLATE
    const isEdit = Boolean(editingTpl);
    const formTitle = isEdit
      ? `### ✏️ Update Template: "${editingTpl?.name}"`
      : "### ➕ Create New Template (Pages or Posts)";

    result.push(blocks.section(formTitle));

    const fields: FormField[] = [
      elements.textInput("tpl_name", "Template Name", {
        placeholder: "e.g. Landing Page Layanan Kabupaten",
        initialValue: editingTpl?.name || "",
      }),
      elements.select(
        "tpl_collection",
        "Target Collection (Page with Blocks vs Post)",
        [
          { label: "Pages (Marketing Blocks — Hero, Split, Features, FAQ, CTA)", value: "pages" },
          { label: "Posts (Blog / Articles — Markdown & Portable Text)", value: "posts" },
        ],
        { initialValue: editingTpl?.targetCollection || "pages" }
      ),
      elements.textInput("tpl_title", "Title Pattern (supports {{tokens}})", {
        placeholder: "e.g. Jasa {{layanan}} Murah di {{kabupaten}}",
        initialValue: editingTpl?.titlePattern || "",
      }),
      elements.textInput("tpl_slug", "Slug Pattern (stored, but the URL slug is generated from the title)", {
        placeholder: "e.g. jasa-{{layanan | slug}}-{{kabupaten | slug}}",
        initialValue: editingTpl?.slugPattern || "",
      }),
      elements.textInput("tpl_excerpt", "Excerpt / Subheadline Pattern", {
        placeholder: "e.g. Solusi {{layanan}} profesional dan terpercaya di {{kabupaten}}, {{provinsi}}.",
        initialValue: editingTpl?.excerptPattern || "",
      }),
      elements.textInput(
        "tpl_blocks_json",
        "Page Blocks Skeleton JSON (For Pages: Marketing Blocks with {{tokens}})",
        {
          multiline: true,
          placeholder: PAGE_BLOCK_PRESETS.landing_page,
          initialValue: editingTpl?.blocksJson || PAGE_BLOCK_PRESETS.landing_page,
        }
      ),
      elements.textInput("tpl_body", "Post Body Pattern (For Posts: Markdown with {{tokens}})", {
        multiline: true,
        placeholder:
          "# {{title}}\n\nLayanan {{layanan}} hadir di wilayah {{kabupaten}} dengan gratis ongkir.\n\n## Keunggulan Kami\n- Cepat & Bergaransi\n- Tim Ahli Berpengalaman\n- Hubungi 6285799520350",
        initialValue: editingTpl?.bodyPattern || "",
      }),
      elements.textInput("tpl_seo_title", "SEO Title Pattern (Optional)", {
        placeholder: "{{kabupaten}} | Jasa {{layanan}} Berkualitas",
        initialValue: editingTpl?.seoTitlePattern || "",
      }),
      elements.textInput("tpl_seo_desc", "SEO Description Pattern (Optional)", {
        placeholder: "Cari jasa {{layanan}} terbaik di {{kabupaten}}? Hubungi kami sekarang.",
        initialValue: editingTpl?.seoDescPattern || "",
      }),
      elements.select(
        "tpl_status",
        "Default Output Status",
        [
          { label: "Draft", value: "draft" },
          { label: "Published", value: "published" },
        ],
        { initialValue: editingTpl?.defaultStatus || "draft" }
      ),
    ];

    result.push(
      blocks.form({
        fields,
        submit: {
          label: isEdit ? "Update Template" : "Save New Template",
          actionId: isEdit ? "update_template" : "save_template",
        },
      })
    );

    if (isEdit) {
      result.push(
        blocks.actions([
          elements.button("cancel_edit_template", "Cancel Editing", {
            style: "secondary",
          }),
        ])
      );
    }
  }

  // ==========================================
  // TAB: DATASETS (CRUD)
  // ==========================================
  else if (state.activeTab === "datasets") {
    const editingDs = state.editingDatasetId
      ? datasets.find((d) => d.id === state.editingDatasetId)
      : undefined;

    if (datasets.length > 0) {
      result.push(blocks.section("### 📊 Saved Datasets (Read)"));
      const rows = datasets.map((d) => ({
        name: d.name,
        rows_count: String(d.rows.length),
        headers: d.headers.join(", "),
        id: d.id,
      }));

      result.push(
        blocks.table({
          columns: [
            { key: "name", label: "Dataset Name" },
            { key: "rows_count", label: "Rows" },
            { key: "headers", label: "Available Tokens" },
            { key: "id", label: "Dataset ID" },
          ],
          rows,
          pageActionId: "page_datasets",
          emptyText: "No datasets saved.",
        })
      );

      const dsOptions = datasets.map((d) => ({
        label: `${d.name} (${d.rows.length} rows)`,
        value: d.id,
      }));

      result.push(blocks.section("#### Manage Selected Dataset"));
      result.push(
        blocks.form({
          fields: [
            elements.select("manage_dataset_id", "Select Dataset to Edit / Delete", dsOptions, {
              initialValue: editingDs?.id || state.selectedDatasetId || dsOptions[0].value,
            }),
          ],
          submit: {
            label: "Edit Selected Dataset",
            actionId: "load_edit_dataset",
          },
        })
      );

      result.push(
        blocks.actions([
          elements.button("action_delete_dataset", "Delete Selected Dataset", {
            style: "danger",
            confirm: {
              title: "Delete Dataset?",
              text: "Are you sure you want to delete this CSV dataset?",
              confirm: "Delete",
              deny: "Cancel",
            },
          }),
        ])
      );

      result.push(blocks.divider());
    }

    const isEditDs = Boolean(editingDs);
    const formDsTitle = isEditDs
      ? `### ✏️ Update Dataset: "${editingDs?.name}"`
      : "### ➕ Add New Dataset (CSV)";

    result.push(blocks.section(formDsTitle));
    result.push(
      blocks.form({
        fields: [
          elements.textInput("ds_name", "Dataset Name", {
            placeholder: "e.g. Data Kabupaten & Layanan Jawa Barat",
            initialValue: editingDs?.name || "",
          }),
          elements.textInput("ds_csv", "CSV Data (First line must be column headers)", {
            multiline: true,
            placeholder:
              "kabupaten,layanan,provinsi,ongkir\nBandung,Cetak Buku,Jawa Barat,Gratis\nBogor,Pembuatan Website,Jawa Barat,Gratis\nBekasi,Cetak Buku Hardcover,Jawa Barat,Rp 10.000\nSurabaya,Cetak Majalah,Jawa Timur,Gratis",
            initialValue: editingDs?.csvContent || "",
          }),
        ],
        submit: {
          label: isEditDs ? "Update Dataset" : "Parse & Save Dataset",
          actionId: isEditDs ? "update_dataset" : "save_dataset",
        },
      })
    );

    if (isEditDs) {
      result.push(
        blocks.actions([
          elements.button("cancel_edit_dataset", "Cancel Editing", {
            style: "secondary",
          }),
        ])
      );
    }
  }

  // ==========================================
  // TAB: PREVIEW & DRY RUN
  // ==========================================
  else if (state.activeTab === "preview") {
    if (templates.length === 0 || datasets.length === 0) {
      result.push(
        blocks.section("⚠️ Please create at least one Template and Dataset first.")
      );
    } else {
      const templateOptions = templates.map((t) => ({
        label: `${t.name} [${t.targetCollection.toUpperCase()}]`,
        value: t.id,
      }));
      const datasetOptions = datasets.map((d) => ({
        label: `${d.name} (${d.rows.length} rows)`,
        value: d.id,
      }));

      result.push(blocks.section("### 🔍 Test Preview & Dry Run"));
      result.push(
        blocks.form({
          fields: [
            elements.select("sel_template_id", "Select Template", templateOptions, {
              initialValue: state.selectedTemplateId || templateOptions[0].value,
            }),
            elements.select("sel_dataset_id", "Select Dataset", datasetOptions, {
              initialValue: state.selectedDatasetId || datasetOptions[0].value,
            }),
            elements.textInput("preview_row_idx", "Preview Row Number (1-based)", {
              placeholder: "1",
              initialValue: "1",
            }),
          ],
          submit: {
            label: "Preview Single Row",
            actionId: "run_preview",
          },
        })
      );

      result.push(
        blocks.actions([
          elements.button("trigger_dry_run", "Run Dry Run (Simulate Full Dataset)", {
            style: "primary",
          }),
        ])
      );

      if (state.previewResult) {
        result.push(blocks.divider());
        result.push(blocks.section("### 🎯 Rendered Preview Output"));
        result.push(
          blocks.fields([
            { label: "Rendered Title", value: state.previewResult.title },
            { label: "Rendered Slug", value: state.previewResult.slug },
            { label: "Rendered Excerpt", value: state.previewResult.excerpt },
            { label: "SEO Title", value: state.previewResult.seoTitle || "(Same as Title)" },
            { label: "SEO Description", value: state.previewResult.seoDesc || "(Same as Excerpt)" },
          ])
        );

        result.push(blocks.section("#### Content Structure (Blocks / Portable Text)"));
        result.push(
          blocks.code({
            code: state.previewResult.bodyText,
            language: "bash",
          })
        );
      }

      if (state.dryRunResult) {
        result.push(blocks.divider());
        result.push(blocks.section("### 📊 Dry Run Simulation Results"));
        result.push(
          blocks.stats([
            { label: "Total Rows", value: String(state.dryRunResult.total) },
            { label: "Will Create", value: String(state.dryRunResult.willCreate) },
            { label: "Will Update", value: String(state.dryRunResult.willUpdate) },
            { label: "Will Skip", value: String(state.dryRunResult.willSkip) },
          ])
        );

        const dryRows = state.dryRunResult.items.map((item) => ({
          row: String(item.rowIdx),
          slug: item.slug,
          action: item.action.toUpperCase(),
          message: item.message || "",
        }));

        result.push(
          blocks.table({
            columns: [
              { key: "row", label: "Row #" },
              { key: "slug", label: "Slug" },
              { key: "action", label: "Planned Action" },
              { key: "message", label: "Details" },
            ],
            rows: dryRows,
            pageActionId: "page_dryrun",
          })
        );
      }
    }
  }

  // ==========================================
  // TAB: GENERATE
  // ==========================================
  else if (state.activeTab === "generate") {
    if (templates.length === 0 || datasets.length === 0) {
      result.push(
        blocks.section("⚠️ Please create at least one Template and Dataset first.")
      );
    } else {
      const templateOptions = templates.map((t) => ({
        label: `${t.name} [${t.targetCollection.toUpperCase()}]`,
        value: t.id,
      }));
      const datasetOptions = datasets.map((d) => ({
        label: `${d.name} (${d.rows.length} rows)`,
        value: d.id,
      }));

      result.push(blocks.section("### ⚡ Execute Generation Engine"));
      result.push(
        blocks.form({
          fields: [
            elements.select("gen_template_id", "Select Template", templateOptions, {
              initialValue: state.selectedTemplateId || templateOptions[0].value,
            }),
            elements.select("gen_dataset_id", "Select Dataset", datasetOptions, {
              initialValue: state.selectedDatasetId || datasetOptions[0].value,
            }),
            elements.select(
              "gen_mode",
              "Conflict Handling Mode",
              [
                { label: "Skip Existing (Safe — skips matching slugs)", value: "skip_existing" },
                { label: "Update Existing (Overwrite matching slugs)", value: "update_existing" },
                { label: "Create Only (Throw error / skip on duplicate)", value: "create_only" },
              ],
              { initialValue: "skip_existing" }
            ),
          ],
          submit: {
            label: "Execute Bulk Generation",
            actionId: "execute_generation",
          },
        })
      );

      if (state.lastRunResult) {
        result.push(blocks.divider());
        result.push(blocks.section("### ✅ Generation Complete"));
        result.push(
          blocks.stats([
            { label: "Total Processed", value: String(state.lastRunResult.stats.total) },
            { label: "Created", value: String(state.lastRunResult.stats.created) },
            { label: "Updated", value: String(state.lastRunResult.stats.updated) },
            { label: "Skipped", value: String(state.lastRunResult.stats.skipped) },
            { label: "Errors", value: String(state.lastRunResult.stats.errors) },
          ])
        );

        const genRows = state.lastRunResult.items.map((item) => ({
          row: String(item.rowIdx),
          slug: item.slug,
          action: item.action.toUpperCase(),
          status: item.message || "Done",
        }));

        result.push(
          blocks.table({
            columns: [
              { key: "row", label: "Row #" },
              { key: "slug", label: "Slug" },
              { key: "action", label: "Action" },
              { key: "status", label: "Status" },
            ],
            rows: genRows,
            pageActionId: "page_gen_results",
          })
        );
      }
    }
  }

  // ==========================================
  // TAB: RUNS & BULK DELETE
  // ==========================================
  else if (state.activeTab === "history") {
    if (runs.length === 0) {
      result.push(blocks.section("No generation runs recorded yet."));
    } else {
      result.push(blocks.section("### 📜 Past Generation Runs"));

      const runRows = runs.map((r) => ({
        id: r.id,
        template: r.templateName,
        dataset: r.datasetName,
        created_count: String(r.stats.created),
        updated_count: String(r.stats.updated),
        mode: r.mode,
        date: new Date(r.createdAt).toLocaleString("id-ID"),
      }));

      result.push(
        blocks.table({
          columns: [
            { key: "id", label: "Run ID" },
            { key: "template", label: "Template" },
            { key: "dataset", label: "Dataset" },
            { key: "created_count", label: "Created" },
            { key: "updated_count", label: "Updated" },
            { key: "mode", label: "Mode" },
            { key: "date", label: "Date" },
          ],
          rows: runRows,
          pageActionId: "page_runs",
        })
      );

      result.push(blocks.divider());
      result.push(blocks.section("### 🗑️ Bulk Delete Generated Content"));
      result.push(
        blocks.section(
          "Permanently delete all pages or posts created during a specific generation run."
        )
      );

      const runSelectOptions = runs.map((r) => ({
        label: `${r.id} (${r.templateName} - ${r.stats.created + r.stats.updated} items)`,
        value: r.id,
      }));

      result.push(
        blocks.form({
          fields: [
            elements.select("del_run_id", "Select Run to Delete", runSelectOptions, {
              initialValue: runSelectOptions[0].value,
            }),
          ],
          submit: {
            label: "Permanently Delete Items",
            actionId: "execute_bulk_delete",
          },
        })
      );
    }
  }

  return result;
}
