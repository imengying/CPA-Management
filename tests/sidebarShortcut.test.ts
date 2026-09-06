import { describe, expect, test } from 'bun:test';
import { getSidebarShortcutLabel, isSidebarToggleShortcut } from '@/utils/sidebarShortcut';

describe('Sidebar Shortcut Logic', () => {
  test('matches Cmd+B and Ctrl+B regardless of key case', () => {
    expect(isSidebarToggleShortcut({ key: 'b', metaKey: true, ctrlKey: false })).toBe(true);
    expect(isSidebarToggleShortcut({ key: 'B', metaKey: false, ctrlKey: true })).toBe(true);
  });

  test('rejects unrelated keys and modifier-free input', () => {
    expect(isSidebarToggleShortcut({ key: 'b', metaKey: false, ctrlKey: false })).toBe(false);
    expect(isSidebarToggleShortcut({ key: 'c', metaKey: true, ctrlKey: false })).toBe(false);
  });

  test('does not intercept editable targets', () => {
    const input = { tagName: 'INPUT', isContentEditable: false } as unknown as HTMLElement;
    const textarea = { tagName: 'TEXTAREA', isContentEditable: false } as unknown as HTMLElement;
    const editor = { tagName: 'DIV', isContentEditable: true } as unknown as HTMLElement;
    const button = { tagName: 'BUTTON', isContentEditable: false } as unknown as HTMLElement;

    expect(isSidebarToggleShortcut({ key: 'b', metaKey: true, ctrlKey: false, target: input })).toBe(
      false
    );
    expect(
      isSidebarToggleShortcut({ key: 'b', metaKey: true, ctrlKey: false, target: textarea })
    ).toBe(false);
    expect(
      isSidebarToggleShortcut({ key: 'b', metaKey: true, ctrlKey: false, target: editor })
    ).toBe(false);
    expect(
      isSidebarToggleShortcut({ key: 'b', metaKey: true, ctrlKey: false, target: button })
    ).toBe(true);
  });

  test('formats platform-specific labels', () => {
    expect(getSidebarShortcutLabel(true)).toBe('⌘B');
    expect(getSidebarShortcutLabel(false)).toBe('Ctrl+B');
  });
});
