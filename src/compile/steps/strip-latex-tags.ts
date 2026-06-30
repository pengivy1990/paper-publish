import type {
  CompileContext,
  CompileInput,
  CompileManuscriptInput,
  CompileSceneInput,
} from "..";
import {
  CompileStepKind,
  makeBuiltinStep,
} from "./abstract-compile-step";

const TEX_TAG_REGEX = /,\s*\\tag\{[^}]*\}\s*/gm;
const STANDALONE_TAG_REGEX = /\\tag\{[^}]*\}\s*/gm;

export const StripLatexTagsStep = makeBuiltinStep({
  id: "strip-latex-tags",
  description: {
    name: "Strip LaTeX Tags",
    description:
      "Removes `\\tag{...}` from display math equations. Use this before Export to Word to avoid LaTeX-specific equation numbering conflicting with pandoc-crossref.",
    availableKinds: [CompileStepKind.Scene, CompileStepKind.Manuscript],
    options: [],
  },
  compile(input: CompileInput, context: CompileContext): CompileInput {
    const stripTags = (contents: string) => {
      contents = contents.replace(TEX_TAG_REGEX, "\n");
      contents = contents.replace(STANDALONE_TAG_REGEX, "\n");
      return contents;
    };

    if (context.kind === CompileStepKind.Scene) {
      return (input as CompileSceneInput[]).map((sceneInput) => {
        const contents = stripTags(sceneInput.contents);
        return { ...sceneInput, contents };
      });
    } else {
      return {
        ...(input as CompileManuscriptInput),
        contents: stripTags((input as any).contents),
      };
    }
  },
});
