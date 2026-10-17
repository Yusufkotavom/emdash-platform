import { definePlugin, type RouteContext } from "emdash";
import { parseCsv } from "./engine/csv.js";
import { slugify } from "./engine/tokens.js";
import {
  renderRow,
  dryRun,
  executeRun,
  bulkDeleteRun,
  type TemplateRecord,
  type DatasetRecord,
  type RunRecord,
  type RenderedContent,
  type RunItemLog,
  PAGE_BLOCK_PRESETS,
} from "./engine/runner.js";
import { renderPluginUi, type ViewState } from "./ui/views.js";

interface InteractionPayload {
  type: "page_load" | "block_action" | "form_submit";
  action_id?: string;
  page?: string;
  value?: unknown;
  values?: Record<string, unknown>;
}

export function createPlugin() {
  return definePlugin({
    id: "bulk-generator",
    version: "1.0.0",
    capabilities: ["content:read", "content:write", "content:publish"],
    storage: {
      templates: { indexes: ["name", "targetCollection"] },
      datasets: { indexes: ["name"] },
      runs: { indexes: ["status"] },
    },
    admin: {
      pages: [
        { path: "/generator", label: "Bulk Generator", icon: "sparkle" },
      ],
    },
    routes: {
      admin: {
        handler: async (ctx: RouteContext) => {
          const input = (ctx.input || {}) as InteractionPayload;
          const storage = ctx.storage as any;
          const content = ctx.content as any;
          const kv = ctx.kv as any;

          // Load current state from KV or default
          let activeTab: ViewState["activeTab"] = (await kv.get("active_tab")) || "templates";
          let editingTemplateId: string | undefined = (await kv.get("editing_template_id")) || undefined;
          let editingDatasetId: string | undefined = (await kv.get("editing_dataset_id")) || undefined;
          let selectedTemplateId: string | undefined = (await kv.get("sel_template_id")) || undefined;
          let selectedDatasetId: string | undefined = (await kv.get("sel_dataset_id")) || undefined;
          let previewResult: RenderedContent | undefined = (await kv.get("preview_result")) || undefined;
          let dryRunResult:
            | {
                total: number;
                willCreate: number;
                willUpdate: number;
                willSkip: number;
                items: RunItemLog[];
              }
            | undefined = (await kv.get("dryrun_result")) || undefined;
          let lastRunResult: RunRecord | undefined = (await kv.get("last_run_result")) || undefined;

          let toast: { message: string; type: "success" | "error" | "info" } | undefined;

          // Fetch all templates: Primary source is native "page_templates" collection (Custom Post Type)
          const getTemplates = async (): Promise<TemplateRecord[]> => {
            const result: TemplateRecord[] = [];

            // 1. From native EmDash page_templates collection (visual page editor)
            try {
              const listRes = await content.list("page_templates", { limit: 100 });
              for (const item of listRes.items || []) {
                const data = (item.data || {}) as Record<string, unknown>;
                const rawContent = data.content ?? (item as any).content;
                let blocksJson = "";
                if (typeof rawContent === "string") {
                  blocksJson = rawContent;
                } else if (rawContent) {
                  blocksJson = JSON.stringify(rawContent, null, 2);
                }

                result.push({
                  id: item.id,
                  name: String(item.title || data.title || item.slug),
                  targetCollection: ((data.target_collection || "pages") as "pages" | "posts"),
                  titlePattern: String(data.title || item.title || ""),
                  slugPattern: String(data.slug_pattern || item.slug || "jasa-{{layanan | slug}}-{{kabupaten | slug}}"),
                  excerptPattern: String(data.excerpt_pattern || data.excerpt || ""),
                  bodyPattern: String(data.body_pattern || ""),
                  seoTitlePattern: String(data.seo_title_pattern || ""),
                  seoDescPattern: String(data.seo_desc_pattern || ""),
                  blocksJson: blocksJson || PAGE_BLOCK_PRESETS.landing_page,
                  defaultStatus: (item.status as any) || "published",
                  isCollectionPage: true,
                  createdAt: String(item.createdAt || ""),
                  updatedAt: String(item.updatedAt || ""),
                });
              }
            } catch {
              // fallback
            }

            // 2. From plugin storage (for backward compatibility)
            try {
              const res = await storage.templates.query({ limit: 100 });
              for (const i of res.items || []) {
                if (!result.some((r) => r.id === i.data.id)) {
                  result.push(i.data);
                }
              }
            } catch {
              // ignore
            }

            return result;
          };

          const getDatasets = async (): Promise<DatasetRecord[]> => {
            const res = await storage.datasets.query({ limit: 100 });
            return (res.items || []).map((i: any) => i.data);
          };

          const getRuns = async (): Promise<RunRecord[]> => {
            const res = await storage.runs.query({ limit: 100 });
            return (res.items || []).map((i: any) => i.data).reverse();
          };

          // -------------------------------------------------------------
          // 1. NAVIGATION TABS
          // -------------------------------------------------------------
          if (input.type === "block_action" && input.action_id?.startsWith("tab_")) {
            const targetTab = input.action_id.replace("tab_", "") as ViewState["activeTab"];
            activeTab = targetTab;
            await kv.set("active_tab", activeTab);
          }

          // -------------------------------------------------------------
          // 2. TEMPLATE ACTIONS (Native Custom Post Type & CRUD)
          // -------------------------------------------------------------
          else if (input.type === "form_submit" && input.action_id === "load_edit_template") {
            const tplId = String(input.values?.manage_template_id || "");
            if (tplId) {
              editingTemplateId = tplId;
              selectedTemplateId = tplId;
              await kv.set("editing_template_id", editingTemplateId);
              await kv.set("sel_template_id", selectedTemplateId);
              toast = { type: "info", message: "Template loaded into form." };
            }
          }

          else if (input.type === "block_action" && input.action_id === "cancel_edit_template") {
            editingTemplateId = undefined;
            await kv.set("editing_template_id", null);
            toast = { type: "info", message: "Editing cancelled." };
          }

          else if (input.type === "block_action" && input.action_id === "action_delete_template") {
            const templates = await getTemplates();
            const targetId = editingTemplateId || selectedTemplateId || templates[0]?.id;
            if (targetId) {
              try {
                // Delete from native collection
                await (content as any).delete("page_templates", targetId);
              } catch {
                // Fallback delete from storage
                await storage.templates.delete(targetId);
              }
              if (editingTemplateId === targetId) {
                editingTemplateId = undefined;
                await kv.set("editing_template_id", null);
              }
              toast = { type: "success", message: "Template deleted successfully." };
            }
          }

          // Create new Template in native "page_templates" collection (Custom Post Type)
          else if (input.type === "form_submit" && input.action_id === "save_template") {
            const values = input.values || {};
            const name = String(values.tpl_name || "").trim();
            const collection = String(values.tpl_collection || "pages") as "posts" | "pages";
            const titlePattern = String(values.tpl_title || "").trim();
            const slugPattern = String(values.tpl_slug || "").trim();
            const blocksJson = String(values.tpl_blocks_json || "").trim();
            const bodyPattern = String(values.tpl_body || "").trim();
            const excerptPattern = String(values.tpl_excerpt || "").trim();
            const seoTitlePattern = String(values.tpl_seo_title || "").trim();
            const seoDescPattern = String(values.tpl_seo_desc || "").trim();
            const defaultStatus = String(values.tpl_status || "published") as "draft" | "published";

            if (!name || !titlePattern) {
              toast = {
                type: "error",
                message: "Please fill in Template Name and Title Pattern.",
              };
            } else {
              // Posts render from the markdown body, so they carry no page
              // blocks. Pages parse the skeleton JSON (falling back to the
              // landing-page preset) and must be a valid blocks array.
              let parsedBlocks: unknown[] = [];
              if (collection === "pages") {
                try {
                  parsedBlocks = JSON.parse(blocksJson || PAGE_BLOCK_PRESETS.landing_page);
                } catch {
                  parsedBlocks = JSON.parse(PAGE_BLOCK_PRESETS.landing_page);
                }
              }

              try {
                const created = await (content as any).create("page_templates", {
                  title: titlePattern || name,
                  slug: slugify(name),
                  slug_pattern: slugPattern || `jasa-{{layanan | slug}}-{{kabupaten | slug}}`,
                  target_collection: collection,
                  body_pattern: bodyPattern,
                  excerpt_pattern: excerptPattern,
                  seo_title_pattern: seoTitlePattern,
                  seo_desc_pattern: seoDescPattern,
                  content: parsedBlocks,
                  status: defaultStatus,
                });
                selectedTemplateId = created.id;
                await kv.set("sel_template_id", selectedTemplateId);
                toast = {
                  type: "success",
                  message: `Template "${name}" created in Page Templates collection! Edit visually in Admin > Page Templates.`,
                };
              } catch (err: any) {
                toast = { type: "error", message: `Failed to create template: ${err?.message}` };
              }
            }
          }

          // Update template in native "page_templates" collection
          else if (input.type === "form_submit" && input.action_id === "update_template") {
            if (!editingTemplateId) {
              toast = { type: "error", message: "No template selected for update." };
            } else {
              const values = input.values || {};
              const name = String(values.tpl_name || "").trim();
              const collection = String(values.tpl_collection || "pages") as "posts" | "pages";
              const titlePattern = String(values.tpl_title || "").trim();
              const slugPattern = String(values.tpl_slug || "").trim();
              const blocksJson = String(values.tpl_blocks_json || "").trim();
              const bodyPattern = String(values.tpl_body || "").trim();
              const excerptPattern = String(values.tpl_excerpt || "").trim();
              const seoTitlePattern = String(values.tpl_seo_title || "").trim();
              const seoDescPattern = String(values.tpl_seo_desc || "").trim();
              const defaultStatus = String(values.tpl_status || "published") as "draft" | "published";

              let parsedBlocks: unknown[] = [];
              if (collection === "pages") {
                try {
                  parsedBlocks = JSON.parse(blocksJson || PAGE_BLOCK_PRESETS.landing_page);
                } catch {
                  parsedBlocks = JSON.parse(PAGE_BLOCK_PRESETS.landing_page);
                }
              }

              try {
                await (content as any).update("page_templates", editingTemplateId, {
                  title: titlePattern || name,
                  slug_pattern: slugPattern,
                  target_collection: collection,
                  body_pattern: bodyPattern,
                  excerpt_pattern: excerptPattern,
                  seo_title_pattern: seoTitlePattern,
                  seo_desc_pattern: seoDescPattern,
                  content: parsedBlocks,
                  status: defaultStatus,
                });
                editingTemplateId = undefined;
                await kv.set("editing_template_id", null);
                toast = { type: "success", message: `Template "${name}" updated successfully!` };
              } catch (err: any) {
                toast = { type: "error", message: `Update error: ${err?.message}` };
              }
            }
          }

          // -------------------------------------------------------------
          // 3. DATASET CRUD
          // -------------------------------------------------------------
          else if (input.type === "form_submit" && input.action_id === "load_edit_dataset") {
            const dsId = String(input.values?.manage_dataset_id || "");
            if (dsId) {
              editingDatasetId = dsId;
              selectedDatasetId = dsId;
              await kv.set("editing_dataset_id", editingDatasetId);
              await kv.set("sel_dataset_id", selectedDatasetId);
              toast = { type: "info", message: "Dataset loaded into editor below." };
            }
          }

          else if (input.type === "block_action" && input.action_id === "cancel_edit_dataset") {
            editingDatasetId = undefined;
            await kv.set("editing_dataset_id", null);
            toast = { type: "info", message: "Dataset editing cancelled." };
          }

          else if (input.type === "block_action" && input.action_id === "action_delete_dataset") {
            const datasets = await getDatasets();
            const targetId = editingDatasetId || selectedDatasetId || datasets[0]?.id;
            if (targetId) {
              await storage.datasets.delete(targetId);
              if (editingDatasetId === targetId) {
                editingDatasetId = undefined;
                await kv.set("editing_dataset_id", null);
              }
              toast = { type: "success", message: "Dataset deleted successfully." };
            }
          }

          else if (input.type === "form_submit" && input.action_id === "save_dataset") {
            const values = input.values || {};
            const name = String(values.ds_name || "").trim();
            const csvText = String(values.ds_csv || "").trim();

            if (!name || !csvText) {
              toast = { type: "error", message: "Please provide Dataset Name and CSV data." };
            } else {
              const parsed = parseCsv(csvText);
              if (parsed.headers.length === 0 || parsed.rows.length === 0) {
                toast = { type: "error", message: "Invalid CSV. Must contain headers and at least 1 data row." };
              } else {
                const id = "ds_" + Date.now();
                const newDs: DatasetRecord = {
                  id,
                  name,
                  csvContent: csvText,
                  headers: parsed.headers,
                  rows: parsed.rows,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };

                await storage.datasets.put(id, newDs);
                selectedDatasetId = id;
                await kv.set("sel_dataset_id", selectedDatasetId);
                toast = {
                  type: "success",
                  message: `Dataset "${name}" saved (${parsed.rows.length} rows, tokens: ${parsed.headers.join(", ")})`,
                };
              }
            }
          }

          else if (input.type === "form_submit" && input.action_id === "update_dataset") {
            if (!editingDatasetId) {
              toast = { type: "error", message: "No dataset selected for update." };
            } else {
              const values = input.values || {};
              const name = String(values.ds_name || "").trim();
              const csvText = String(values.ds_csv || "").trim();

              const parsed = parseCsv(csvText);
              if (!name || parsed.headers.length === 0 || parsed.rows.length === 0) {
                toast = { type: "error", message: "Invalid dataset or CSV content." };
              } else {
                const existing = (await storage.datasets.get(editingDatasetId)) as DatasetRecord | null;
                const updatedDs: DatasetRecord = {
                  id: editingDatasetId,
                  name,
                  csvContent: csvText,
                  headers: parsed.headers,
                  rows: parsed.rows,
                  createdAt: existing?.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };

                await storage.datasets.put(editingDatasetId, updatedDs);
                editingDatasetId = undefined;
                await kv.set("editing_dataset_id", null);
                toast = { type: "success", message: `Dataset "${name}" updated successfully!` };
              }
            }
          }

          // -------------------------------------------------------------
          // 4. PREVIEW & DRY RUN
          // -------------------------------------------------------------
          else if (input.type === "form_submit" && input.action_id === "run_preview") {
            const values = input.values || {};
            const tplId = String(values.sel_template_id || "");
            const dsId = String(values.sel_dataset_id || "");
            const rowIdx = Math.max(1, parseInt(String(values.preview_row_idx || "1"), 10)) - 1;

            selectedTemplateId = tplId;
            selectedDatasetId = dsId;
            await kv.set("sel_template_id", selectedTemplateId);
            await kv.set("sel_dataset_id", selectedDatasetId);

            const templates = await getTemplates();
            const tpl = templates.find((t) => t.id === tplId);
            const ds = (await storage.datasets.get(dsId)) as DatasetRecord | null;

            if (!tpl || !ds) {
              toast = { type: "error", message: "Selected template or dataset not found." };
            } else if (!ds.rows[rowIdx]) {
              toast = { type: "error", message: `Row ${rowIdx + 1} does not exist in dataset (total: ${ds.rows.length}).` };
            } else {
              previewResult = renderRow(tpl, ds.rows[rowIdx]);
              dryRunResult = undefined;
              await kv.set("preview_result", previewResult);
              await kv.set("dryrun_result", null);
              toast = { type: "info", message: `Preview rendered for row #${rowIdx + 1}!` };
            }
          } else if (input.type === "block_action" && input.action_id === "trigger_dry_run") {
            const templates = await getTemplates();
            const datasets = await getDatasets();

            const tplId = selectedTemplateId || templates[0]?.id;
            const dsId = selectedDatasetId || datasets[0]?.id;

            const tpl = templates.find((t) => t.id === tplId);
            const ds = datasets.find((d) => d.id === dsId);

            if (!tpl || !ds) {
              toast = { type: "error", message: "Please select template and dataset first." };
            } else {
              const res = await dryRun(tpl, ds, content, "skip_existing");
              dryRunResult = res;
              await kv.set("dryrun_result", dryRunResult);
              toast = {
                type: "info",
                message: `Dry Run finished: ${res.willCreate} to create, ${res.willUpdate} to update, ${res.willSkip} to skip.`,
              };
            }
          }

          // -------------------------------------------------------------
          // 5. GENERATE
          // -------------------------------------------------------------
          else if (input.type === "form_submit" && input.action_id === "execute_generation") {
            const values = input.values || {};
            const tplId = String(values.gen_template_id || "");
            const dsId = String(values.gen_dataset_id || "");
            const mode = String(values.gen_mode || "skip_existing") as any;

            const templates = await getTemplates();
            const tpl = templates.find((t) => t.id === tplId);
            const ds = (await storage.datasets.get(dsId)) as DatasetRecord | null;

            if (!tpl || !ds) {
              toast = { type: "error", message: "Template or Dataset not found." };
            } else {
              const run = await executeRun(tpl, ds, content, mode);
              lastRunResult = run;
              await storage.runs.put(run.id, run);
              await kv.set("last_run_result", lastRunResult);

              toast = {
                type: "success",
                message: `Generation completed! Created: ${run.stats.created}, Updated: ${run.stats.updated}, Skipped: ${run.stats.skipped}`,
              };
            }
          }

          // -------------------------------------------------------------
          // 6. BULK DELETE
          // -------------------------------------------------------------
          else if (input.type === "form_submit" && input.action_id === "execute_bulk_delete") {
            const values = input.values || {};
            const runId = String(values.del_run_id || "");

            const run = (await storage.runs.get(runId)) as RunRecord | null;
            if (!run) {
              toast = { type: "error", message: "Run not found." };
            } else {
              const templates = await getTemplates();
              const tpl = templates.find((t) => t.id === run.templateId) || {
                id: run.templateId,
                name: run.templateName,
                targetCollection: run.targetCollection || ("pages" as const),
                titlePattern: "",
                slugPattern: "",
                defaultStatus: "draft" as const,
              };

              const deletedCount = await bulkDeleteRun(run, tpl, content);
              await storage.runs.delete(runId);
              toast = {
                type: "success",
                message: `Successfully deleted ${deletedCount} generated items from collection "${tpl.targetCollection}".`,
              };
            }
          }

          // Load updated lists for view rendering
          const currentTemplates = await getTemplates();
          const currentDatasets = await getDatasets();
          const currentRuns = await getRuns();

          const viewState: ViewState = {
            activeTab,
            editingTemplateId,
            editingDatasetId,
            previewResult,
            dryRunResult,
            lastRunResult,
            selectedTemplateId,
            selectedDatasetId,
          };

          const blocks = renderPluginUi(viewState, currentTemplates, currentDatasets, currentRuns);

          return {
            blocks,
            ...(toast ? { toast } : {}),
          };
        },
      },
    },
  });
}
