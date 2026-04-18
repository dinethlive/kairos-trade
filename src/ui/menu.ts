// Menu descriptors for nested arrow-key selection menus.
// Commands can push a menu onto the Zustand `menuStack`; the UI renders the
// topmost menu in place of the prompt. Item handlers may either resolve the
// menu (returning a value) or open a child menu by pushing another descriptor.

export interface MenuItem {
  label: string;
  hint?: string;
  // Invoked when the item is selected. Use helpers from MenuController to
  // either close this menu (resolve) or open a child. A promise is awaited.
  onSelect: (ctrl: MenuController) => void | Promise<void>;
  // Rendered to the left of the label. Defaults to a bullet. When a menu is in
  // 'multi' mode, items render a checkbox reflecting their `checked` state.
  checked?: boolean;
  disabled?: boolean;
}

export interface MenuDefinition {
  id: string;
  title: string;
  subtitle?: string;
  items: MenuItem[];
  // Shown in the footer; defaults to the generic help line.
  footer?: string;
  // Called when the menu is cancelled (Esc / backspace on empty).
  onCancel?: () => void;
}

export interface MenuController {
  // Close every menu up to and including this one.
  close: () => void;
  // Close every menu (back to the prompt).
  closeAll: () => void;
  // Replace this menu with another.
  replace: (next: MenuDefinition) => void;
  // Push a child menu on top of this one.
  push: (child: MenuDefinition) => void;
  // Write a line to the transcript.
  log: (text: string, kind?: 'info' | 'warn' | 'error') => void;
}
