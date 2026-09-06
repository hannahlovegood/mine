// The web demo's portal, rendered to static HTML (`npm run ext:fixture` at the repo root).
// The extractor should recover something close to src/content/demo-content.{en,zh}.ts: the same
// kinds and importances for the blocks that matter. Exact equality is not required.
import { describe, expect, it } from 'vitest';
import { PageContentSchema } from '@engine/schema.ts';
import { extractPage, type ExtractedPage } from '../src/extract/index.ts';
import {
  actionsOf,
  blockText,
  boxHoldsOnlyItsControl,
  byKind,
  deadlinesOf,
  decisionsOf,
  fieldsOf,
  findBlock,
  imagesOf,
  loadFixture,
  navsOf,
} from './helpers.ts';

interface Expect {
  fixture: string;
  lang: 'en' | 'zh';
  title: string;
  menu: string[];
  utility: string[];
  labels: string[];
  requiredLabels: string[];
  deadline: string;
  deadlineText: string;
  attestStart: string;
  consentStart: string;
  consequenceHas: string;
  submit: string;
  save: string;
  download: string;
  chat: string;
  promoHas: string;
  rateHas: string;
  noticeHas: string;
  privacyHas: string;
  eligibilityHas: string;
  faqFirstHas: string;
  introHas: string;
  formHeading: string;
  partTitle: (n: number) => string;
  selectOptionsOf: string;
  selectOptionsFirst: string;
}

const EN: Expect = {
  fixture: 'portal-en.html',
  lang: 'en',
  title: 'Housing Stability Grant — online application',
  menu: ['Home', 'Benefits', 'Housing', 'Apply', 'Check status', 'Documents', 'Forms', 'FAQ', 'Contact', 'Accessibility', 'Language', 'Sign in'],
  utility: ['Text size', 'Print', 'Share', 'Translate', 'Help'],
  labels: [
    'Full legal name',
    'Date of birth',
    'Telephone number',
    'Email address',
    'Street address of the rental unit',
    'City and ZIP code',
    'Household size',
    'Tenancy type',
    'Gross monthly household income',
    'Primary source of household income',
    'Proof of income',
    'Hardship statement',
  ],
  requiredLabels: [
    'Full legal name',
    'Date of birth',
    'Telephone number',
    'Street address of the rental unit',
    'City and ZIP code',
    'Household size',
    'Tenancy type',
    'Gross monthly household income',
    'Primary source of household income',
    'Proof of income',
  ],
  deadline: '2026-10-23',
  deadlineText: 'October 23, 2026',
  attestStart: 'I certify',
  consentStart: 'I agree that Alder County',
  consequenceHas: 'nonprofit and community organizations',
  submit: 'Submit application',
  save: 'Save draft',
  download: 'Download PDF',
  chat: 'Chat with an agent',
  promoHas: 'Get the Alder County Benefits app',
  rateHas: 'Rate your experience',
  noticeHas: 'Scheduled maintenance',
  privacyHas: 'Privacy notice',
  eligibilityHas: 'Eligibility. An applicant shall',
  faqFirstHas: 'Who can apply',
  introHas: 'The Housing Stability Grant (HSG) is a means-tested',
  formHeading: 'Application form',
  partTitle: (n) => `Part ${n}`,
  selectOptionsOf: 'Tenancy type',
  selectOptionsFirst: 'Written lease',
};

const ZH: Expect = {
  fixture: 'portal-zh.html',
  lang: 'zh',
  title: '灵活就业人员社会保险补贴——网上申领',
  menu: ['首页', '就业服务', '社保服务', '网上申领', '进度查询', '申报材料', '表格下载', '常见问题', '联系我们', '无障碍', '繁體版', '登录'],
  utility: ['字号', '打印', '分享', '收藏', '帮助'],
  labels: [
    '姓名',
    '出生日期',
    '手机号码',
    '电子邮箱',
    '现居住地址',
    '户籍所在区县及邮政编码',
    '家庭人口数（含本人）',
    '户籍类型',
    '家庭月收入（元）',
    '主要收入来源',
    '收入及缴费证明材料',
    '就业困难情况说明',
  ],
  requiredLabels: ['姓名', '出生日期', '手机号码', '现居住地址', '户籍所在区县及邮政编码', '家庭人口数（含本人）', '户籍类型', '家庭月收入（元）', '主要收入来源', '收入及缴费证明材料'],
  deadline: '2026-10-30',
  deadlineText: '2026年10月30日',
  attestStart: '本人承诺',
  consentStart: '本人同意云溪市',
  consequenceHas: '勾选后',
  submit: '提交申请',
  save: '暂存',
  download: '下载PDF',
  chat: '在线客服',
  promoHas: '云溪人社',
  rateHas: '请为本次办事体验评分',
  noticeHas: '系统维护通知',
  privacyHas: '隐私声明',
  eligibilityHas: '申领条件',
  faqFirstHas: '哪些人可以申领',
  introHas: '灵活就业人员社会保险补贴（以下简称',
  formHeading: '申领信息填报',
  partTitle: (n) => `第 ${n} 部分`,
  selectOptionsOf: '户籍类型',
  selectOptionsFirst: '本市城镇户籍',
};

function describePortal(x: Expect): void {
  describe(x.fixture, () => {
    const doc = loadFixture(x.fixture);
    const page: ExtractedPage = extractPage(doc);
    const { blocks, meta } = page.content;

    it('validates and has at least 35 blocks', () => {
      expect(PageContentSchema.safeParse(page.content).success).toBe(true);
      expect(blocks.length).toBeGreaterThanOrEqual(35);
      expect(blocks.length).toBeLessThanOrEqual(60);
      expect(meta.lang).toBe(x.lang);
      expect(page.lang).toBe(x.lang);
      expect(meta.title).toBe(x.title);
    });

    it('finds the 12 fields with their labels, 10 of them required and critical', () => {
      const fields = fieldsOf(page);
      expect(fields.map((f) => f.label)).toEqual(x.labels);
      expect(fields.filter((f) => f.required).map((f) => f.label)).toEqual(x.requiredLabels);
      for (const f of fields) {
        expect(f.importance).toBe(f.required ? 'critical' : 'primary');
        expect(f.help && f.help.length > 10, `${f.label} help`).toBe(true);
      }
      expect(fields.map((f) => f.input)).toEqual(['text', 'date', 'tel', 'email', 'text', 'text', 'number', 'select', 'number', 'select', 'file', 'text']);
      const select = fields.find((f) => f.label === x.selectOptionsOf)!;
      expect(select.options?.[0]).toBe(x.selectOptionsFirst);
      expect(select.options?.length).toBeGreaterThanOrEqual(4);
    });

    it('finds exactly two decisions: the pre-checked optional consent and the critical attestation', () => {
      const decisions = decisionsOf(page);
      expect(decisions).toHaveLength(2);
      const [consent, attest] = decisions;
      expect(consent!.label.startsWith(x.consentStart)).toBe(true);
      expect(consent).toMatchObject({ optional: true, preChecked: true, importance: 'primary' });
      expect(consent!.consequence).toContain(x.consequenceHas);
      expect(consent!.label).not.toContain(x.consequenceHas);
      expect(attest!.label.startsWith(x.attestStart)).toBe(true);
      expect(attest).toMatchObject({ optional: false, preChecked: false, importance: 'critical' });
    });

    it('finds the deadline paragraph with its ISO date, critical, ungrouped, in main', () => {
      const deadlines = deadlinesOf(page);
      expect(deadlines).toHaveLength(1);
      const d = deadlines[0]!;
      expect(d.date).toBe(x.deadline);
      expect(d.text).toContain(x.deadlineText);
      expect(d.importance).toBe('critical');
      expect(d.group).toBeUndefined();
      expect(d.region).toBeUndefined();
    });

    it('recognises the 12-item site menu as primary nav in the header, and the utility bar', () => {
      const navs = navsOf(page);
      const menu = navs.find((n) => n.importance === 'primary');
      expect(menu?.items).toEqual(x.menu);
      expect(menu?.region).toBe('header');
      expect(navs.filter((n) => n.importance === 'primary')).toHaveLength(1);
      const utility = navs.find((n) => n.region === 'utility');
      expect(utility?.items).toEqual(x.utility);
      expect(utility?.importance).toBe('secondary');
    });

    it('recognises the sidebar (related links + 3 announcements) and the footer (privacy notice + links)', () => {
      const sidebarNav = navsOf(page).find((n) => n.region === 'sidebar');
      expect(sidebarNav?.items).toHaveLength(8);
      expect(sidebarNav?.importance).toBe('secondary');
      const announcements = byKind(page, 'text').filter((t) => t.region === 'sidebar');
      expect(announcements.length).toBeGreaterThanOrEqual(3);
      expect(announcements.every((t) => t.importance === 'secondary')).toBe(true);
      const footerNav = navsOf(page).find((n) => n.region === 'footer');
      expect(footerNav?.items).toHaveLength(6);
      const privacy = findBlock(page, x.privacyHas)!;
      expect(privacy.kind).toBe('legal');
      expect(privacy.importance).toBe('critical');
      expect(privacy.region).toBe('footer');
      expect(page.regions.get('header')).toBeDefined();
      expect(page.regions.get('utility')).toBeDefined();
      expect(page.regions.get('sidebar')).toBeDefined();
      expect(page.regions.get('footer')).toBeDefined();
      expect(page.regions.get('main')).toBe(doc.querySelector('.portal-main'));
    });

    it('sets aside the decorations: app promo, hero image, rate-this-page, floating chat', () => {
      const promo = findBlock(page, x.promoHas)!;
      expect(promo.kind).toBe('promo');
      expect(promo.importance).toBe('decorative');
      const rate = findBlock(page, x.rateHas)!;
      expect(rate.kind).toBe('promo');
      expect(rate.importance).toBe('decorative');
      expect(rate.region).toBe('sidebar');
      const images = imagesOf(page);
      expect(images).toHaveLength(2);
      expect(images[0]).toMatchObject({ decorative: true, importance: 'decorative' });
      expect(images[0]!.src).toContain('hero-rowhouses');
      expect(images[1]).toMatchObject({ decorative: false, importance: 'primary' });
      expect(images[1]!.alt.length).toBeGreaterThan(10);
      const chat = actionsOf(page).find((a) => a.label === x.chat)!;
      expect(chat).toMatchObject({ primary: false, importance: 'decorative' });
      expect(chat.group).toBeUndefined();
      expect(blocks.filter((b) => b.importance === 'decorative').length).toBeGreaterThanOrEqual(3);
      expect(actionsOf(page).some((a) => /get the app|立即下载/i.test(a.label))).toBe(false);
    });

    it('finds the 6 FAQ items, the maintenance notice, the two instructions and the eligibility legal block', () => {
      const faqs = byKind(page, 'faq');
      expect(faqs).toHaveLength(6);
      expect(faqs.every((f) => f.importance === 'secondary')).toBe(true);
      expect(faqs[0]!.text).toContain(x.faqFirstHas);
      const notice = findBlock(page, x.noticeHas)!;
      expect(notice.kind).toBe('notice');
      expect(notice.importance).toBe('secondary');
      expect(byKind(page, 'instruction').length).toBeGreaterThanOrEqual(2);
      const eligibility = findBlock(page, x.eligibilityHas)!;
      expect(eligibility.kind).toBe('legal');
      expect(eligibility.importance).toBe('primary');
    });

    it('reads the title heading as level 1 and the form heading as level 2', () => {
      const headings = byKind(page, 'heading');
      expect(headings.map((h) => [h.text, h.level])).toEqual([
        [x.title, 1],
        [x.formHeading, 2],
      ]);
      expect(headings.every((h) => h.importance === 'primary')).toBe(true);
    });

    it('reads the three form actions (submit critical) and groups them with the last step', () => {
      const actions = actionsOf(page);
      const submit = actions.find((a) => a.label === x.submit)!;
      expect(submit).toMatchObject({ primary: true, importance: 'critical' });
      const save = actions.find((a) => a.label === x.save)!;
      expect(save).toMatchObject({ primary: false, importance: 'primary' });
      const download = actions.find((a) => a.label === x.download)!;
      expect(download).toMatchObject({ primary: false, importance: 'primary' });
      const last = meta.stepOrder.at(-1)!.id;
      expect([submit.group, save.group, download.group]).toEqual([last, last, last]);
    });

    it('builds steps of four with the attestation in the submit step, every field and decision grouped', () => {
      expect(meta.stepOrder.length).toBeGreaterThanOrEqual(3);
      expect(meta.stepOrder.map((s) => s.title)).toEqual(meta.stepOrder.map((_, i) => x.partTitle(i + 1)));
      const stepIds = meta.stepOrder.map((s) => s.id);
      const fields = fieldsOf(page);
      for (const f of fields) expect(stepIds).toContain(f.group);
      expect(fields.slice(0, 4).map((f) => f.group)).toEqual([stepIds[0], stepIds[0], stepIds[0], stepIds[0]]);
      expect(fields.slice(4, 8).every((f) => f.group === stepIds[1])).toBe(true);
      expect(fields.slice(8, 12).every((f) => f.group === stepIds[2])).toBe(true);
      const [consent, attest] = decisionsOf(page);
      expect(consent!.group).toBe(stepIds.at(-1));
      expect(attest!.group).toBe(stepIds.at(-1));
      for (const b of blocks) {
        if (b.kind === 'field' || b.kind === 'decision') continue;
        if (b.kind === 'action' && b.group) continue;
        expect(b.group, `${b.id} ${b.kind} should be ungrouped`).toBeUndefined();
      }
    });

    it('gives every field and decision a box that contains its node and no other control', () => {
      for (const b of [...fieldsOf(page), ...decisionsOf(page)]) {
        expect(boxHoldsOnlyItsControl(page, b.id)).toEqual({ ok: true, why: '' });
        expect(page.boxes.get(b.id)!.contains(page.nodes.get(b.id)!)).toBe(true);
      }
      expect(page.form).toBe(doc.querySelector('.portal-form'));
      expect(page.main).toBe(doc.querySelector('.portal-main'));
    });

    it('marks main text primary and the intro complex; header/sidebar/footer text secondary', () => {
      for (const b of byKind(page, 'text')) {
        expect(b.importance, blockText(b).slice(0, 30)).toBe(b.region === undefined ? 'primary' : 'secondary');
      }
      const intro = findBlock(page, x.introHas)!;
      expect(['text', 'legal']).toContain(intro.kind);
      expect(intro.importance).toBe('primary');
      expect(intro.region).toBeUndefined();
      expect('complexity' in intro && intro.complexity).toBe('complex');
    });
  });
}

describePortal(EN);
describePortal(ZH);
