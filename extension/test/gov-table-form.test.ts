// A Chinese government "table form": a <table> of label cells and input cells, radios with
// trailing text labels, a captcha image with onclick, an image submit and a javascript: back
// link, 本人承诺 / 我已阅读并同意 checkboxes with trailing text, an attachment list, a small
// notice box with a yearless "6月30日前" phrasing and a real "截止到2026年6月30日前" deadline.
// Review findings [17], [19], [21], [43], [64], plus the box rule [0] with an image action.
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage } from '../src/extract/index.ts';
import { actionsOf, blockText, boxHoldsOnlyItsControl, byKind, deadlinesOf, decisionsOf, fieldsOf, findBlock, imagesOf, loadFixture, navsOf } from './helpers.ts';

describe('gov-table-form.html', () => {
  const doc = loadFixture('gov-table-form.html');
  const page = extractPage(doc);
  const { meta } = page.content;

  it('validates, sniffs Chinese, and picks the content column as main with the form inside', () => {
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
    expect(page.lang).toBe('zh');
    expect(meta.title).toBe('2026年度高校毕业生就业补贴在线申报 - 云溪市人力资源和社会保障局');
    expect(page.main).toBe(doc.querySelector('.content'));
    expect(page.form).toBe(doc.querySelector('form'));
    expect(page.regions.get('header')).toBeUndefined();
    expect(page.regions.get('footer')).toBeUndefined();
  });

  it('reads the six fields from the label cells, the radio group with its trailing-text options', () => {
    const fields = fieldsOf(page);
    expect(fields.map((f) => [f.label, f.input, f.required])).toEqual([
      ['姓名', 'text', true],
      ['性别', 'select', false],
      ['身份证号', 'text', true],
      ['毕业院校', 'text', false],
      ['就业单位', 'text', false],
      ['验证码', 'text', true],
    ]);
    expect(fields[1]!.options).toEqual(['男', '女']);
    expect(fields[3]!.help).toBe('（请填写学校全称）');
    for (const f of fields) expect(boxHoldsOnlyItsControl(page, f.id)).toEqual({ ok: true, why: '' });
    expect(page.boxes.get(fields[2]!.id)?.localName).toBe('tr');
    expect(page.boxes.get(fields[3]!.id)?.localName).toBe('tr');
  });

  it('never lets a field box swallow the captcha image action or a button', () => {
    const code = fieldsOf(page).find((f) => f.label === '验证码')!;
    const box = page.boxes.get(code.id)!;
    expect(box.querySelector('img,button,input[type=image],[role=button]')).toBeNull();
    for (const a of actionsOf(page)) {
      const node = page.nodes.get(a.id)!;
      for (const f of [...fieldsOf(page), ...decisionsOf(page)]) {
        expect(page.boxes.get(f.id)!.contains(node), `${f.label} box must not hold action ${a.label}`).toBe(false);
      }
    }
  });

  it('reads the two trailing-text checkboxes as required attestations (本人承诺, 我已阅读并同意)', () => {
    const [promise, read, ...rest] = decisionsOf(page);
    expect(rest).toHaveLength(0);
    expect(promise!.label.startsWith('本人承诺以上填报信息真实有效')).toBe(true);
    expect(promise).toMatchObject({ optional: false, preChecked: false, importance: 'critical' });
    expect(read!.label).toBe('我已阅读并同意《申报须知》');
    expect(read).toMatchObject({ optional: false, preChecked: false, importance: 'critical' });
    for (const d of [promise!, read!]) expect(boxHoldsOnlyItsControl(page, d.id)).toEqual({ ok: true, why: '' });
    expect(byKind(page, 'text').some((t) => t.text.includes('本人承诺'))).toBe(false);
  });

  it('reads the image submit as the critical action, the captcha and the javascript: back image as actions, never decorative images', () => {
    const actions = actionsOf(page);
    expect(actions.map((a) => [a.label, a.primary, a.importance])).toEqual([
      ['看不清？点击更换', false, 'primary'],
      ['提交申报', true, 'critical'],
      ['返回', false, 'primary'],
    ]);
    expect(page.nodes.get(actions[0]!.id)).toBe(doc.querySelector('#captcha'));
    expect(page.nodes.get(actions[1]!.id)?.getAttribute('type')).toBe('image');
    expect(page.nodes.get(actions[2]!.id)?.localName).toBe('a');
    const images = imagesOf(page);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ decorative: true, alt: '云溪市人力资源和社会保障局' });
  });

  it('finds the dated deadline and keeps the yearless 6月30日前 notice as primary text', () => {
    const deadlines = deadlinesOf(page);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]).toMatchObject({ date: '2026-06-30', importance: 'critical' });
    expect(deadlines[0]!.text).toContain('截止到2026年6月30日前');
    const tip = findBlock(page, '温馨提示')!;
    expect(tip.kind).toBe('text');
    expect(tip.importance).toBe('primary');
    expect(tip.region).toBeUndefined();
  });

  it('reads the attachment list as a primary instruction block, not a nav', () => {
    const attachments = findBlock(page, '申报表模板')!;
    expect(attachments.kind).toBe('instruction');
    expect(attachments.importance).toBe('primary');
    expect(attachments.region).toBeUndefined();
    expect(blockText(attachments)).toBe('附件1：就业补贴申报表模板.doc 附件2：个人承诺书.pdf 附件3：单位人员汇总表.xls');
    expect(page.nodes.get(attachments.id)?.localName).toBe('ul');
    expect(navsOf(page).some((n) => n.items.some((i) => i.includes('附件')))).toBe(false);
  });

  it('keeps the site menu primary, the breadcrumb secondary, and the bottom line in the footer', () => {
    const navs = navsOf(page);
    const menu = navs.find((n) => n.importance === 'primary')!;
    expect(menu.items).toEqual(['首页', '政务公开', '网上办事', '政策法规', '互动交流', '联系我们']);
    expect(menu.region).toBe('header');
    const crumb = navs.find((n) => n !== menu)!;
    expect(crumb.items).toEqual(['首页', '网上办事']);
    expect(crumb.importance).toBe('secondary');
    expect(findBlock(page, '主办单位')).toMatchObject({ kind: 'text', importance: 'secondary', region: 'footer' });
    expect(byKind(page, 'heading')).toEqual([expect.objectContaining({ text: '2026年度高校毕业生就业补贴在线申报', level: 1, importance: 'primary' })]);
  });

  it('builds one step from the h1, with every control, both attestations and the form actions in it', () => {
    expect(meta.stepOrder).toEqual([{ id: 's-1', title: '2026年度高校毕业生就业补贴在线申报' }]);
    for (const b of [...fieldsOf(page), ...decisionsOf(page)]) expect(b.group).toBe('s-1');
    expect(actionsOf(page).find((a) => a.primary)?.group).toBe('s-1');
  });
});
