// A Chinese government notice: breadcrumb, title, meta line, paragraphs (one with 截止 + date),
// a table, an attachment list, no form at all.
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage } from '../src/extract/index.ts';
import { actionsOf, blockText, byKind, deadlinesOf, decisionsOf, fieldsOf, findBlock, imagesOf, loadFixture, navsOf } from './helpers.ts';

describe('gov-notice-zh.html', () => {
  const doc = loadFixture('gov-notice-zh.html');
  const page = extractPage(doc);
  const { blocks, meta } = page.content;

  it('validates, is Chinese, and takes the title from <title>', () => {
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
    expect(page.lang).toBe('zh');
    expect(meta.title).toBe('关于开展2026年度灵活就业人员社会保险补贴申报工作的通知 - 云溪市人力资源和社会保障局');
    expect(blocks.length).toBeGreaterThanOrEqual(20);
  });

  it('has no form: no fields, decisions or actions, no form root, one placeholder step', () => {
    expect(fieldsOf(page)).toHaveLength(0);
    expect(decisionsOf(page)).toHaveLength(0);
    expect(actionsOf(page)).toHaveLength(0);
    expect(page.form).toBeUndefined();
    expect(meta.stepOrder).toEqual([{ id: 's-1', title: '第 1 部分' }]);
  });

  it('finds the deadline paragraph (截止 + 2026年10月30日) and nothing else as a deadline', () => {
    const deadlines = deadlinesOf(page);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]).toMatchObject({ date: '2026-10-30', importance: 'critical' });
    expect(deadlines[0]!.text).toContain('申报截止时间');
    expect(deadlines[0]!.group).toBeUndefined();
    const metaLine = findBlock(page, '发布时间')!;
    expect(metaLine.kind).toBe('text');
    const sign = findBlock(page, '2026年9月1日')!;
    expect(sign.kind).toBe('text');
  });

  it('reads the h1 as a level-1 heading and the numbered sub-titles as text', () => {
    const headings = byKind(page, 'heading');
    expect(headings).toHaveLength(1);
    expect(headings[0]).toMatchObject({ level: 1, text: '关于开展2026年度灵活就业人员社会保险补贴申报工作的通知', importance: 'primary' });
    expect(findBlock(page, '一、申报对象')?.kind).toBe('text');
    expect(findBlock(page, '三、补贴标准')?.kind).toBe('text');
  });

  it('turns every table cell with text into a primary text block', () => {
    const cells = byKind(page, 'text').filter((b) => ['td', 'th'].includes(page.nodes.get(b.id)!.localName));
    expect(cells).toHaveLength(12);
    expect(cells.map(blockText).slice(0, 4)).toEqual(['人员类别', '补贴比例', '补贴期限', '就业困难人员']);
    expect(cells.every((c) => c.importance === 'primary' && c.region === undefined)).toBe(true);
  });

  it('reads the attachment list as one primary instruction block in main with the three file names', () => {
    // review [64]: required attachments are part of the task, not navigation
    const attachments = findBlock(page, '申请表')!;
    expect(attachments.kind).toBe('instruction');
    expect(attachments.importance).toBe('primary');
    expect(attachments.region).toBeUndefined();
    expect(blockText(attachments)).toBe('1. 灵活就业人员社会保险补贴申请表.docx 2. 灵活就业登记证明样式.pdf 3. 无收入承诺书（云人社表-07）.pdf');
    expect(navsOf(page).some((n) => n.items.some((i) => i.includes('申请表')))).toBe(false);
    expect(findBlock(page, '附件：')?.kind).toBe('text');
  });

  it('reads the site menu (8 items, primary, header) and the breadcrumb (secondary)', () => {
    const navs = navsOf(page);
    const menu = navs.find((n) => n.importance === 'primary')!;
    expect(menu.items).toEqual(['首页', '机构概况', '政务公开', '政策法规', '办事服务', '互动交流', '就业创业', '社会保障']);
    expect(menu.region).toBe('header');
    const crumb = navs.find((n) => n.items.includes('政务公开') && n !== menu)!;
    expect(crumb.items).toEqual(['首页', '政务公开', '通知公告']);
    expect(crumb.importance).toBe('secondary');
    expect(page.regions.get('header')).toBe(doc.querySelector('.header'));
    expect(page.regions.get('footer')).toBe(doc.querySelector('.footer'));
    expect(page.regions.get('sidebar')).toBeUndefined();
    expect(page.main).toBe(doc.querySelector('.content'));
  });

  it('marks the paragraph about 个人信息 as critical legal text', () => {
    const legal = findBlock(page, '个人信息')!;
    expect(legal.kind).toBe('legal');
    expect(legal.importance).toBe('critical');
    expect(legal.region).toBeUndefined();
  });

  it('keeps ordinary paragraphs primary text and the header logo a decorative image', () => {
    const intro = findBlock(page, '为贯彻落实')!;
    expect(intro.kind).toBe('text');
    expect(intro.importance).toBe('primary');
    const images = imagesOf(page);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ decorative: true, importance: 'decorative', region: 'header', alt: '云溪市人力资源和社会保障局' });
  });

  it('puts the footer lines in the footer region as secondary text', () => {
    const footer = blocks.filter((b) => b.region === 'footer');
    expect(footer).toHaveLength(2);
    expect(footer.every((b) => b.kind === 'text' && b.importance === 'secondary')).toBe(true);
    expect(blockText(footer[0]!)).toContain('主办单位');
  });
});
