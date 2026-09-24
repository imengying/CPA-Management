import { beforeAll, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { ConfigTabs } from '@/features/config/components/ConfigTabs';
import { SectionCommon } from '@/features/config/components/sections/SectionCommon';
import { SectionCard } from '@/features/config/components/SectionCard';
import { DEFAULT_VISUAL_VALUES } from '@/types/visualConfig';

const noop = () => {};

/**
 * 「常用」是 tabs 的别名视图：tab 标签已经承载了标题。
 * 卡片若再渲染一次 title/description，就会读成「常用 常用 …」。
 */
describe('common tab heading deduplication', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('zh-CN');
  });

  const renderCommon = () =>
    renderToStaticMarkup(
      createElement(SectionCommon, {
        values: DEFAULT_VISUAL_VALUES,
        validationErrors: {},
        disabled: false,
        animateIn: false,
        onChange: noop,
      })
    );

  test('the common card renders no heading at all', () => {
    const markup = renderCommon();
    const title = i18n.t('config_management.visual.sections.common.title');

    expect(markup).not.toContain('<header');
    expect(markup).not.toContain('<h2');
    expect(markup).not.toContain(`>${title}<`);
    // 描述文案已随卡头一并移除，不应再出现在任何位置。
    expect(markup).not.toContain('最常调整的配置项');
    expect(markup).not.toContain('与完整分区共享同一份数据');
  });

  test('the tab still carries the visible label', () => {
    const markup = renderToStaticMarkup(
      createElement(ConfigTabs, {
        active: 'common',
        errorCounts: {},
        dirtyTabs: new Set(),
        onChange: noop,
      })
    );
    // 标题只在 tab 上出现一次：卡片不再重复。
    const title = i18n.t('config_management.visual.sections.common.title');
    expect(markup.split(`>${title}</span>`).length - 1).toBe(1);
  });

  test('the common card still renders its fields', () => {
    const markup = renderCommon();
    expect(markup).toContain(`>${i18n.t('config_management.visual.sections.server.host')}<`);
    expect(markup).toContain(`>${i18n.t('config_management.visual.sections.server.port')}<`);
  });

  test('canonical sections keep their numbered heading', () => {
    const markup = renderToStaticMarkup(
      createElement(SectionCard, { indexLabel: '01', title: '接入与认证', description: '说明' }, 'body')
    );
    expect(markup).toContain('<header');
    expect(markup).toContain('<h2');
    expect(markup).toContain('01');
    expect(markup).toContain('说明');
  });

  test('a heading renders when any part is provided', () => {
    expect(renderToStaticMarkup(createElement(SectionCard, {}, 'body'))).not.toContain('<header');
    for (const props of [{ title: 'T' }, { description: 'D' }, { icon: 'I' }, { indexLabel: '1' }]) {
      expect(renderToStaticMarkup(createElement(SectionCard, props, 'body'))).toContain('<header');
    }
  });
});
