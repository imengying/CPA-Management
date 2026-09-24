import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/features/quota/QuotaPage.tsx', 'utf8');
const styles = readFileSync('src/features/quota/QuotaPage.module.scss', 'utf8');

describe('quota toolbar presentation contracts', () => {
  test('uses a named, explicit clear action and restores input focus', () => {
    expect(source).toContain('type="search"');
    expect(source).toContain('ref={searchInputRef}');
    expect(source).toContain('{search ? (');
    expect(source).toContain("aria-label={t('quota_management.search_clear')}");
    expect(source).toMatch(/handleSearchChange\(''\);\s*\n\s*searchInputRef\.current\?\.focus\(\);/);
    expect(source).toContain('<IconX size={14} aria-hidden="true" />');
    // 自定义清除按钮与原生 search 取消按钮会重叠，必须只保留一个。
    expect(styles).toMatch(/&::-webkit-search-cancel-button\s*\{[^}]*display: none;/);
  });

  test('groups search and sorting next to provider navigation', () => {
    const tabsStart = source.indexOf('<ProviderTabs');
    const controlsStart = source.indexOf('<div className={styles.toolbarControls}>');
    const searchStart = source.indexOf('<div className={styles.search}>');
    const sortStart = source.indexOf('<div className={styles.sort}>');

    expect(controlsStart).toBeGreaterThan(tabsStart);
    expect(searchStart).toBeGreaterThan(controlsStart);
    expect(sortStart).toBeGreaterThan(searchStart);

    // tabs 吃掉剩余宽度，控件组固定宽度不被压缩。
    expect(styles).toMatch(/\.toolbarControls\s*\{[^}]*flex: 0 0 auto;/);
    expect(styles).toMatch(/\.search\s*\{[^}]*flex: 0 0 auto;/);
    expect(styles).toContain('&:focus-visible');
  });
});
