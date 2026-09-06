// An Element UI (Vue) admin form: radios and checkboxes are aria-hidden inputs inside <label>
// wrappers with a visible label span, required is a CSS asterisk driven by `.is-required` on the
// form item, one label has no `for`, an `.el-form-item__error` sits under a field, a role=alert
// box precedes the form, and buttons are `el-button--primary`.
// Review findings [39] (role=alert is at least primary), [43]/[44] (aria-hidden choices, label in
// the same form item, required from ancestor classes), [18] (已阅读并同意 + 协议 is an attestation).
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage } from '../src/extract/index.ts';
import { actionsOf, blockText, boxHoldsOnlyItsControl, byKind, decisionsOf, fieldsOf, findBlock, loadFixture, navsOf } from './helpers.ts';

describe('element-ui.html', () => {
  const doc = loadFixture('element-ui.html');
  const page = extractPage(doc);
  const { blocks, meta } = page.content;

  it('validates, is Chinese, and finds the landmarks', () => {
    expect(PageContentSchema.safeParse(page.content).success).toBe(true);
    expect(page.lang).toBe('zh');
    expect(page.main).toBe(doc.querySelector('main'));
    expect(page.regions.get('header')).toBe(doc.querySelector('header'));
    expect(page.regions.get('sidebar')).toBe(doc.querySelector('aside'));
    expect(page.regions.get('footer')).toBe(doc.querySelector('footer'));
    expect(page.form).toBe(doc.querySelector('form'));
  });

  it('reads the four fields: label[for], a label without for in the same item, the aria-hidden radio group, the phone with its error text', () => {
    const fields = fieldsOf(page);
    expect(fields.map((f) => [f.label, f.input, f.required])).toEqual([
      ['姓名', 'text', true],
      ['部门', 'text', true],
      ['性别', 'select', true],
      ['手机号', 'text', false],
    ]);
    expect(fields[2]!.options).toEqual(['男', '女']);
    expect(page.nodes.get(fields[2]!.id)).toBe(doc.querySelector('input[name=sex]'));
    expect(fields[3]!.help).toBe('手机号格式不正确');
    for (const f of fields) {
      expect(boxHoldsOnlyItsControl(page, f.id)).toEqual({ ok: true, why: '' });
      expect(page.boxes.get(f.id)?.classList.contains('el-form-item'), `${f.label} box is the form item`).toBe(true);
    }
  });

  it('collects the aria-hidden checkboxes: two optional skills (one pre-checked) and the agreement attestation', () => {
    const decisions = decisionsOf(page);
    expect(decisions.map((d) => [d.label, d.optional, d.preChecked, d.importance])).toEqual([
      ['Java 开发', true, false, 'primary'],
      ['项目管理', true, true, 'primary'],
      ['我已阅读并同意《员工信息采集协议》和《隐私政策》', false, false, 'critical'],
    ]);
    for (const d of decisions) {
      expect(boxHoldsOnlyItsControl(page, d.id)).toEqual({ ok: true, why: '' });
      expect(page.boxes.get(d.id)!.querySelectorAll('input[type=checkbox]')).toHaveLength(1);
    }
    expect(page.boxes.get(decisions[0]!.id)?.classList.contains('el-checkbox')).toBe(true);
  });

  it('never turns the label spans, the error text or the alert into stray text blocks', () => {
    const texts = byKind(page, 'text').map(blockText);
    expect(texts.filter((t) => t.startsWith('请如实填写'))).toHaveLength(1);
    expect(texts.some((t) => /^(?:男|女|Java 开发|项目管理|姓名|部门|性别|手机号)$/.test(t))).toBe(false);
    expect(texts.some((t) => t.includes('我已阅读并同意'))).toBe(false);
    expect(texts.some((t) => t.includes('手机号格式不正确'))).toBe(false);
  });

  it('keeps the role=alert box visible: a notice of importance primary, not secondary', () => {
    const alert = findBlock(page, '升级维护')!;
    expect(alert.kind).toBe('notice');
    expect(alert.importance).toBe('primary');
    expect(alert.region).toBeUndefined();
  });

  it('reads 提交 as the critical primary action and 重置 as a plain one, both in the single step', () => {
    expect(actionsOf(page).map((a) => [a.label, a.primary, a.importance, a.group])).toEqual([
      ['提交', true, 'critical', 's-1'],
      ['重置', false, 'primary', 's-1'],
    ]);
    expect(meta.stepOrder).toEqual([{ id: 's-1', title: '员工信息登记' }]);
    for (const b of [...fieldsOf(page), ...decisionsOf(page)]) expect(b.group).toBe('s-1');
  });

  it('keeps the header menu primary, the side menu secondary, and the h2 as the level-1 title', () => {
    const menu = navsOf(page).find((n) => n.importance === 'primary')!;
    expect(menu.items).toEqual(['首页', '员工管理', '考勤', '薪酬', '系统设置']);
    expect(navsOf(page).find((n) => n.region === 'sidebar')?.items).toEqual(['员工列表', '新增员工', '批量导入']);
    expect(byKind(page, 'heading')).toEqual([expect.objectContaining({ text: '员工信息登记', level: 1, importance: 'primary' })]);
    expect(blocks.filter((b) => b.importance === 'decorative')).toHaveLength(0);
  });
});
