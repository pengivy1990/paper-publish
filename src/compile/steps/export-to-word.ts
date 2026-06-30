import { type App, FileSystemAdapter, Notice, Platform, normalizePath } from "obsidian";
import type { CompileContext, CompileManuscriptInput } from "..";
import {
  CompileStepKind,
  CompileStepOptionType,
  makeBuiltinStep,
} from "./abstract-compile-step";

export const ExportToWordStep = makeBuiltinStep({
  id: "export-to-word",
  description: {
    name: "Export to Word",
    description:
      "Exports the compiled manuscript to a Word .docx file using Pandoc, with equation numbering via pandoc-crossref.",
    availableKinds: [CompileStepKind.Manuscript],
    options: [
      {
        id: "output",
        name: "Output path",
        description:
          "Path for the generated Word file. Paths starting with '/' are relative to your vault root; otherwise relative to your project. $1 will be replaced with your project's title.",
        type: CompileStepOptionType.Text,
        default: "$1.docx",
      },
      {
        id: "pandoc-path",
        name: "Pandoc path",
        description:
          "Path to pandoc. Usually 'pandoc' works if Pandoc is installed and available in PATH.",
        type: CompileStepOptionType.Text,
        default: "pandoc",
      },
      {
        id: "use-crossref",
        name: "Use pandoc-crossref",
        description:
          "Enable equation, figure, and table numbering with pandoc-crossref.",
        type: CompileStepOptionType.Boolean,
        default: true,
      },
      {
        id: "auto-number-equations",
        name: "Auto-number display equations",
        description:
          "If enabled, display equations without explicit {#eq:...} labels will also be numbered.",
        type: CompileStepOptionType.Boolean,
        default: true,
      },
      {
        id: "table-equations",
        name: "Use table layout for equations",
        description:
          "Use pandoc-crossref tableEqns mode. This is usually better for Word-style equation centering and right-side numbering.",
        type: CompileStepOptionType.Boolean,
        default: true,
      },
      {
        id: "citeproc",
        name: "Use citeproc",
        description:
          "Enable Pandoc citeproc for bibliography processing. pandoc-crossref will run before citeproc.",
        type: CompileStepOptionType.Boolean,
        default: false,
      },
      {
        id: "reference-doc",
        name: "Reference docx",
        description:
          "Optional path to a reference.docx template. Leave blank if not needed.",
        type: CompileStepOptionType.Text,
        default: "",
      },
      {
        id: "bibliography",
        name: "Bibliography file",
        description:
          "Optional path to a .bib file. Leave blank if not needed.",
        type: CompileStepOptionType.Text,
        default: "",
      },
      {
        id: "csl",
        name: "CSL file",
        description:
          "Optional path to a .csl citation style file. Leave blank if not needed.",
        type: CompileStepOptionType.Text,
        default: "",
      },
    ],
  },
  async compile(
    input: CompileManuscriptInput,
    context: CompileContext
  ): Promise<CompileManuscriptInput> {
    if (context.kind !== CompileStepKind.Manuscript) {
      throw new Error("Cannot export non-manuscript input to Word.");
    }

    if (!Platform.isDesktopApp) {
      throw new Error("Export to Word requires Obsidian desktop.");
    }

    const vaultBasePath = getVaultBasePath(context.app);
    const outputPath = getOutputPath(context);
    const tempMdPath = normalizePath(
      `${context.projectPath}/paper-publish-temp-${Date.now()}.md`
    );

    await ensureContainingFolderExists(context.app, outputPath);
    await context.app.vault.adapter.write(tempMdPath, input.contents);

    const tempMdAbsolutePath = toSystemPath(vaultBasePath, tempMdPath);
    const outputAbsolutePath = toSystemPath(vaultBasePath, outputPath);

    const pandocPath =
      (context.optionValues["pandoc-path"] as string)?.trim() || "pandoc";
    const useCrossref = context.optionValues["use-crossref"] === true;
    const autoNumberEquations =
      context.optionValues["auto-number-equations"] === true;
    const tableEquations = context.optionValues["table-equations"] === true;
    const useCiteproc = context.optionValues["citeproc"] === true;
    const referenceDoc = (context.optionValues["reference-doc"] as string)?.trim() || "";
    const bibliography = (context.optionValues["bibliography"] as string)?.trim() || "";
    const csl = (context.optionValues["csl"] as string)?.trim() || "";

    const args: string[] = [
      tempMdAbsolutePath,
      "-f",
      "markdown+tex_math_dollars",
      "-t",
      "docx",
      "-o",
      outputAbsolutePath,
    ];

    if (useCrossref) {
      args.push("--filter", "pandoc-crossref");
      if (tableEquations) args.push("-M", "tableEqns=true");
      if (autoNumberEquations) args.push("-M", "autoEqnLabels=true");
      args.push("-M", "eqnPrefix=式");
      args.push("-M", "linkReferences=true");
    }

    if (useCiteproc) args.push("--citeproc");

    if (referenceDoc)
      args.push("--reference-doc", resolveExternalPath(vaultBasePath, referenceDoc));
    if (bibliography)
      args.push("--bibliography", resolveExternalPath(vaultBasePath, bibliography));
    if (csl)
      args.push("--csl", resolveExternalPath(vaultBasePath, csl));

    try {
      await runPandoc(pandocPath, args);
      new Notice(`Exported Word document: ${outputPath}`);
    } finally {
      try {
        await context.app.vault.adapter.remove(tempMdPath);
      } catch {
        // Ignore temp-file cleanup failure.
      }
    }

    return input;
  },
});

function getOutputPath(context: CompileContext): string {
  let output = (context.optionValues["output"] as string)?.trim() || "";
  if (!output) throw new Error("Invalid output path for Word export.");
  output = output.replace("$1", context.draft.title);
  if (!output.toLowerCase().endsWith(".docx")) output += ".docx";
  if (output.startsWith("/"))
    return normalizePath(output.substring(1));
  return normalizePath(`${context.projectPath}/${output}`);
}

async function ensureContainingFolderExists(
  app: App,
  filePath: string
): Promise<void> {
  const folderPath = filePath.split("/").slice(0, -1).join("/");
  if (!folderPath) return;
  try {
    await app.vault.createFolder(folderPath);
  } catch {
    // Folder probably already exists.
  }
}

function getVaultBasePath(app: App): string {
  const adapter = app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter))
    throw new Error("Could not resolve vault base path.");
  return adapter.getBasePath();
}

function resolveExternalPath(vaultBasePath: string, path: string): string {
  if (isAbsoluteSystemPath(path)) return path;
  return toSystemPath(vaultBasePath, path.replace(/^\/+/, ""));
}

function toSystemPath(basePath: string, relativePath: string): string {
  const separator = Platform.isWin ? "\\" : "/";
  return [
    basePath.replace(/[\\/]+$/, ""),
    relativePath.replace(/^[\\/]+/, ""),
  ]
    .join(separator)
    .replace(/[\\/]+/g, separator);
}

function isAbsoluteSystemPath(path: string): boolean {
  if (Platform.isWin) return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\");
  return path.startsWith("/");
}

function runPandoc(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const nodeRequire: NodeRequire | undefined = (window as any).require;
    if (!nodeRequire) {
      reject(new Error("Node require is unavailable. Pandoc export only works in Obsidian desktop."));
      return;
    }
    const { spawn } = nodeRequire("child_process") as typeof import("child_process");
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
    child.on("error", (error: Error) => {
      reject(new Error(`Failed to run Pandoc. Make sure Pandoc and pandoc-crossref are installed and available in PATH.\n${error.message}`));
    });
    child.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`Pandoc export failed with exit code ${code}.\n${stderr.trim()}`));
    });
  });
}
