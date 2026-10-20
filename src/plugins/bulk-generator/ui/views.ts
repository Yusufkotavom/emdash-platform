import { blocks, elements, type Block, type FormField } from "@emdash-cms/blocks";
import {
  type TemplateRecord,
  type DatasetRecord,
  type RunRecord,
  type RenderedContent,
  type RunItemLog,
} from "../engine/runner.js";

export interface ViewState {
  activeTab: "generate" | "datasets" | "preview" | "history";
  editingDatasetId?: string;
  selectedTemplateId?: string;
  selectedDatasetId?: string;
  selectedTarget?: "pages" | "posts";
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

const PAGE_TEMPLATES_URL = "/_emdash/admin/content/page_templates";

const TARGET_OPTIONS = [
  {
    label: "Page — Marketing Blocks (Hero, Split, Features, FAQ, CTA)",
    value: "pages",
  },
  { label: "Post — Article (Markdown body & Portable Text)", value: "posts" },
];

function templateLabel(t: TemplateRecord): string {
  return `${t.name} · ${t.targetCollection === "posts" ? "post" : "page"}`;
}

function openTemplatesLink() {
  return elements.link("Open Page Templates", { kind: "external", url: PAGE_TEMPLATES_URL }, { appearance: "primary" });
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
      "Programmatic SEO engine: pick a **Page Template** (single source — managed in *Admin → Page Templates*), a CSV dataset, then preview and generate."
    )
  );

  result.push(
    blocks.actions([
      elements.button("tab_generate", "⚡ Generate", {
        style: state.activeTab === "generate" ? "primary" : "secondary",
      }),
      elements.button("tab_datasets", `📊 Datasets (${datasets.length})`, {
        style: state.activeTab === "datasets" ? "primary" : "secondary",
      }),
      elements.button("tab_preview", "🔍 Preview & Dry Run", {
        style: state.activeTab === "preview" ? "primary" : "secondary",
      }),
      elements.button("tab_history", `📜 Runs & Delete (${runs.length})`, {
        style: state.activeTab === "history" ? "primary" : "secondary",
      }),
    ])
  );

  result.push(blocks.divider());

  const selectedTemplate =
    templates.find((t) => t.id === state.selectedTemplateId) || templates[0];
  const defaultTarget = state.selectedTarget || selectedTemplate?.targetCollection || "pages";

  // ==========================================
  // TAB: GENERATE
  // ==========================================
  if (state.activeTab === "generate") {
    if (templates.length === 0) {
      result.push(
        blocks.empty({
          title: "No page templates yet",
          description:
            "Templates live in one place only: the Page Templates collection. Create one there, then come back to generate.",
          actions: [openTemplatesLink()],
        })
      );
    } else if (datasets.length === 0) {
      result.push(
        blocks.empty({
          title: "No dataset yet",
          description:
            "Upload a CSV dataset first (tab: Datasets). Each row becomes one generated page or post.",
          actions: [
            elements.button("tab_datasets", "Go to Datasets", { style: "primary" }),
            openTemplatesLink(),
          ],
        })
      );
    } else {
      const lastRun = state.lastRunResult;
      result.push(
        blocks.stats([
          { label: "Templates", value: String(templates.length) },
          { label: "Datasets", value: String(datasets.length) },
          { label: "Rows in last run", value: lastRun ? String(lastRun.stats.total) : "—" },
          { label: "Created (last run)", value: lastRun ? String(lastRun.stats.created) : "—" },
        ])
      );

      result.push(blocks.section("### ⚡ Generate Content"));

      const datasetOptions = datasets.map((d) => ({
        label: `${d.name} (${d.rows.length} rows)`,
        value: d.id,
      }));

      const fields: FormField[] = [
        elements.select(
          "gen_template_id",
          "1. Template (from Page Templates)",
          templates.map((t) => ({ label: templateLabel(t), value: t.id })),
          { initialValue: selectedTemplate?.id }
        ),
        elements.select("gen_dataset_id", "2. Dataset (CSV rows)", datasetOptions, {
          initialValue: state.selectedDatasetId || datasetOptions[0]?.value,
        }),
        elements.select("gen_target", "3. Output Type", TARGET_OPTIONS, {
          initialValue: defaultTarget,
        }),
        elements.select(
          "gen_mode",
          "4. Conflict Handling",
          [
            { label: "Skip Existing (safe — keeps matching items)", value: "skip_existing" },
            { label: "Update Existing (overwrite matching items)", value: "update_existing" },
            { label: "Create Only (error on duplicate)", value: "create_only" },
          ],
          { initialValue: "skip_existing" }
        ),
      ];

      result.push(
        blocks.form({
          fields,
          submit: { label: "Run Bulk Generation", actionId: "execute_generation" },
        })
      );

      result.push(
        blocks.section(
          `Edit template content in [Page Templates](${PAGE_TEMPLATES_URL}). Output status follows the template's publish state (published → published, draft → draft).`
        )
      );

      if (lastRun) {
        result.push(blocks.divider());
        result.push(
          blocks.banner({
            title:
              lastRun.stats.errors > 0
                ? `Generation finished with ${lastRun.stats.errors} error(s)`
                : "Generation complete",
            variant: lastRun.stats.errors > 0 ? "alert" : "default",
            description: `${lastRun.templateName} → ${lastRun.targetCollection} · ${lastRun.mode}`,
          })
        );
        result.push(
          blocks.stats([
            { label: "Total Processed", value: String(lastRun.stats.total) },
            { label: "Created", value: String(lastRun.stats.created) },
            { label: "Updated", value: String(lastRun.stats.updated) },
            { label: "Skipped", value: String(lastRun.stats.skipped) },
            { label: "Errors", value: String(lastRun.stats.errors) },
          ])
        );

        const genRows = lastRun.items.map((item) => ({
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
  // TAB: DATASETS (CRUD)
  // ==========================================
  else if (state.activeTab === "datasets") {
    const editingDs = state.editingDatasetId
      ? datasets.find((d) => d.id === state.editingDatasetId)
      : undefined;

    if (datasets.length > 0) {
      result.push(blocks.section("### 📊 Saved Datasets"));
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
      result.push(blocks.section("#### Manage Dataset"));
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
    result.push(
      blocks.section(
        isEditDs
          ? `### ✏️ Update Dataset: "${editingDs?.name}"`
          : "### ➕ Add New Dataset (CSV)"
      )
    );
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
        blocks.empty({
          title: "Nothing to preview",
          description: "You need at least one Page Template and one CSV dataset first.",
          actions: [elements.button("tab_datasets", "Go to Datasets", { style: "primary" })],
        })
      );
    } else {
      const templateOptions = templates.map((t) => ({ label: templateLabel(t), value: t.id }));
      const datasetOptions = datasets.map((d) => ({
        label: `${d.name} (${d.rows.length} rows)`,
        value: d.id,
      }));

      result.push(blocks.section("### 🔍 Preview & Dry Run"));
      result.push(
        blocks.form({
          fields: [
            elements.select("preview_template_id", "1. Template", templateOptions, {
              initialValue: selectedTemplate?.id,
            }),
            elements.select("preview_dataset_id", "2. Dataset", datasetOptions, {
              initialValue: state.selectedDatasetId || datasetOptions[0]?.value,
            }),
            elements.select("preview_target", "3. Output Type", TARGET_OPTIONS, {
              initialValue: defaultTarget,
            }),
            elements.textInput("preview_row_idx", "4. Preview Row Number (1-based)", {
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
          elements.button("trigger_dry_run", "Dry Run — Simulate Full Dataset", {
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
  // TAB: RUNS & BULK DELETE
  // ==========================================
  else if (state.activeTab === "history") {
    if (runs.length === 0) {
      result.push(
        blocks.empty({
          title: "No generation runs yet",
          description: "Every bulk generation run is recorded here.",
        })
      );
    } else {
      result.push(blocks.section("### 📜 Past Generation Runs"));

      const runRows = runs.map((r) => ({
        id: r.id,
        template: r.templateName,
        target: r.targetCollection,
        dataset: r.datasetName,
        created_count: String(r.stats.created),
        updated_count: String(r.stats.updated),
        errors: String(r.stats.errors),
        mode: r.mode,
        date: new Date(r.createdAt).toLocaleString("id-ID"),
      }));

      result.push(
        blocks.table({
          columns: [
            { key: "id", label: "Run ID" },
            { key: "template", label: "Template" },
            { key: "target", label: "Output" },
            { key: "dataset", label: "Dataset" },
            { key: "created_count", label: "Created" },
            { key: "updated_count", label: "Updated" },
            { key: "errors", label: "Errors" },
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
