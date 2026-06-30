import type { Command } from "obsidian";

import type PaperPublishPlugin from "src/main";

export type CommandBuilder = (plugin: PaperPublishPlugin) => Command;
