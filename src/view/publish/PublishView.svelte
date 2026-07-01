<script lang="ts">
  import { Notice } from "obsidian";
  import { selectedDraft, pluginSettings } from "src/model/stores";
  import { useApp } from "../utils";
  import { get } from "svelte/store";

  const app = useApp();

  let format: "docx" | "md" | "both" = "docx";
  let publishStatus = "Ready";
  let isPublishing = false;
  let outputDirInput = "";
  let initialized = false;
  let draftFolder = "";
  let resolvedOutput = "";

  $: if ($pluginSettings && !initialized) {
    outputDirInput = $pluginSettings.outputDir || "";
    initialized = true;
  }

  $: draftFolder = $selectedDraft
    ? $selectedDraft.vaultPath.substring(0, $selectedDraft.vaultPath.lastIndexOf("/") + 1)
    : "";

  $: resolvedOutput = draftFolder + (outputDirInput ? outputDirInput : "").replace(/\/+$/, "");

  function updateOutputDir() {
    pluginSettings.update(s => {
      s.outputDir = outputDirInput || "";
      return s;
    });
  }

  async function assembleManuscript(): Promise<string | null> {
    const draft = get(selectedDraft);
    if (!draft) return null;

    const parts: string[] = [];
    parts.push(`# ${draft.title}\n`);

    if (draft.format === "scenes") {
      for (const scene of draft.scenes) {
        const folder = draft.vaultPath.substring(0, draft.vaultPath.lastIndexOf("/") + 1);
        const path = folder + scene.title + ".md";
        const file = app.vault.getAbstractFileByPath(path);
        if (file) {
          const content = await app.vault.read(file as any);
          const cleaned = content.replace(/^---[\s\S]*?---\n*/, "");
          const indent = scene.indent || 0;
          const headingPrefix = "#".repeat(Math.min(indent + 1, 5));
          const adjusted = cleaned.replace(/^#\s+(.*)/m, `${headingPrefix} $1`);
          parts.push(`\n${adjusted}\n`);
        }
      }
    } else {
      const file = app.vault.getAbstractFileByPath(draft.vaultPath);
      if (file) {
        const content = await app.vault.read(file as any);
        const cleaned = content.replace(/^---[\s\S]*?---\n*/, "");
        parts.push(cleaned);
      }
    }

    return parts.join("\n");
  }

  async function doPublish() {
    const draft = get(selectedDraft);
    if (!draft) return;

    isPublishing = true;
    publishStatus = "Assembling...";

    try {
      const parts: string[] = [];
      parts.push(`# ${draft.title}\n`);

      if (draft.format === "scenes") {
        for (const scene of draft.scenes) {
          const folder = draft.vaultPath.substring(0, draft.vaultPath.lastIndexOf("/") + 1);
          const path = folder + scene.title + ".md";
          const file = app.vault.getAbstractFileByPath(path);
          if (file) {
            const content = await app.vault.read(file as any);
            const cleaned = content.replace(/^---[\s\S]*?---\n*/, "");
            const indent = scene.indent || 0;
            const hp = "#".repeat(Math.min(indent + 1, 5));
            const adj = cleaned.replace(/^#\s+(.*)/m, `${hp} $1`);
            parts.push(`\n${adj}\n`);
          }
        }
      } else {
        const file = app.vault.getAbstractFileByPath(draft.vaultPath);
        if (file) {
          const content = await app.vault.read(file as any);
          const cleaned = content.replace(/^---[\s\S]*?---\n*/, "");
          parts.push(cleaned);
        }
      }

      const content = parts.join("\n");
      const safeName = draft.title.replace(/[<>:"/\\|?*]/g, "_");
      const outputDir = resolvedOutput;
      const settings = get(pluginSettings);

      if (!(await app.vault.adapter.exists(outputDir))) {
        await app.vault.adapter.mkdir(outputDir);
      }

      const formats = format === "both" ? ["md", "docx"] : [format];
      const results: string[] = [];

      for (const fmt of formats) {
        if (fmt === "md") {
          const outPath = `${outputDir}/${safeName}.md`;
          await app.vault.adapter.write(outPath, content);
          results.push(outPath);
        } else if (fmt === "docx") {
          const mdPath = `${outputDir}/${safeName}_temp.md`;
          const docxPath = `${outputDir}/${safeName}.docx`;
          await app.vault.adapter.write(mdPath, content);
          try {
            const { execSync } = require("child_process");
            const base = ((app.vault.adapter as any).basePath || (app.vault.adapter as any).path || "").replace(/\\/g, "/");
            const absMd = `${base}/${mdPath}`.replace(/\/+/g, "/");
            const absDocx = `${base}/${docxPath}`.replace(/\/+/g, "/");
            execSync(`"${"pandoc"}" "${absMd}" -f markdown -t docx -o "${absDocx}"`);
            await app.vault.adapter.remove(mdPath);
            results.push(docxPath);
          } catch {
            results.push(mdPath + " (pandoc not available)");
          }
        }
      }

      publishStatus = results.join(", ");
      new Notice(`Published ${draft.title}`);
    } catch (e) {
      publishStatus = `Error: ${e.message}`;
      console.error("[Paper Publish]", e);
    }

    isPublishing = false;
  }
</script>

<div class="longform-publish-container">
  <h3>Publish</h3>

  {#if $selectedDraft}
    <div>
      <h4>Format</h4>
      <label><input type="radio" bind:group={format} value="docx" /> DOCX</label><br/>
      <label><input type="radio" bind:group={format} value="md" /> Markdown</label><br/>
      <label><input type="radio" bind:group={format} value="both" /> Both</label>
    </div>

    <div style="margin-top: 1em;">
      <p>Draft: <strong>{$selectedDraft.title}</strong></p>
      <label>
        Subpath (relative to project):
        <input
          type="text"
          class="longform-publish-path-input"
          bind:value={outputDirInput}
          on:blur={updateOutputDir}
          placeholder="/"
        />
      </label>
      <p class="longform-publish-resolved">→ {resolvedOutput || draftFolder.replace(/\/+$/, "")}/</p>
    </div>

    <button
      class="longform-publish-button"
      on:click={doPublish}
      disabled={isPublishing}
    >
      {isPublishing ? "Publishing…" : "Publish"}
    </button>

    <p class="longform-publish-status">{publishStatus}</p>
  {:else}
    <p>Select a draft to publish.</p>
  {/if}
</div>

<style>
  .longform-publish-container {
    padding: var(--size-4-4);
    background: var(--background-primary);
    font-size: var(--font-ui-small);
  }

  .longform-publish-container h3 {
    margin: 0 0 var(--size-4-4) 0;
    font-size: var(--font-ui-medium);
  }

  .longform-publish-container h4 {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    margin: 0 0 var(--size-4-2) 0;
    text-transform: uppercase;
  }

  .longform-publish-button {
    width: 100%;
    padding: var(--size-4-2);
    font-weight: bold;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: var(--radius-s);
    cursor: pointer;
    margin: var(--size-4-4) 0;
  }

  .longform-publish-button:hover {
    background-color: var(--interactive-accent-hover);
  }

  .longform-publish-button:disabled {
    background-color: var(--text-muted);
    cursor: not-allowed;
  }

  .longform-publish-status {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .longform-publish-path-input {
    width: 100%;
    margin-top: var(--size-4-1);
    padding: var(--size-4-1) var(--size-4-2);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    box-sizing: border-box;
  }

  .longform-publish-resolved {
    font-size: var(--font-smallest);
    color: var(--text-faint);
    margin: var(--size-4-1) 0 0 0;
  }
</style>
