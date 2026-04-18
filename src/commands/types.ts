import type { BotController } from '../trading/controller';
import type { TranscriptKind } from '../types';
import type { MenuDefinition } from '../ui/menu';

export interface CommandContext {
  controller: BotController;
  append: (kind: TranscriptKind, text: string) => void;
  clearTranscript: () => void;
  openMenu: (menu: MenuDefinition) => void;
  exit: () => void;
}

export interface Command {
  name: string;
  aliases?: string[];
  usage: string;
  description: string;
  handler: (args: string[], ctx: CommandContext) => void | Promise<void>;
}
