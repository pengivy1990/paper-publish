import { ConcatenateTextStep } from "./concatenate-text";
import { ExportToWordStep } from "./export-to-word";
import { PrependTitleStep } from "./prepend-title";
import { RemoveCommentsStep } from "./remove-comments";
import { RemoveLinksStep } from "./remove-links";
import { RemoveStrikethroughsStep } from "./remove-strikethroughs";
import { StripFrontmatterStep } from "./strip-frontmatter";
import { StripLatexTagsStep } from "./strip-latex-tags";
import { WriteToNoteStep } from "./write-to-note";
import { AddFrontmatterStep } from "./add-frontmatter";

export const BUILTIN_STEPS = [
  AddFrontmatterStep,
  ConcatenateTextStep,
  ExportToWordStep,
  PrependTitleStep,
  RemoveCommentsStep,
  RemoveLinksStep,
  RemoveStrikethroughsStep,
  StripFrontmatterStep,
  StripLatexTagsStep,
  WriteToNoteStep,
];
