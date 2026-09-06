// The page you were given (ZH): 云溪市 — 灵活就业人员社会保险补贴，网上申领。
//
// 与 EN 版结构完全一致（同样的 id 顺序、kind、importance、group、region），文字则按政务门户的口吻
// 原生写成，不是翻译。平实版（plainText / plainHelp / plainLabel）保留原文全部事实和全部数字
// 序列（I3），用短句和常用词，用「你」称呼读者，不新增任何说法。`legal` 块的平实版是并列展示的
// 摘要，永远不替换原文（§11）。术语在原文和平实版里都原样出现，两种版本都能加下划线。
//
// 块的顺序就是门户页面的 DOM 顺序；截止日期是正文第四段。
import type { PageContent } from '../engine/schema.ts';

export const contentZh: PageContent = {
  meta: {
    title: '灵活就业人员社会保险补贴——网上申领',
    lang: 'zh',
    stepOrder: [
      { id: 'start', title: '申领前须知' },
      { id: 'you', title: '个人信息' },
      { id: 'home', title: '户籍与居住' },
      { id: 'income', title: '收入与缴费' },
      { id: 'review', title: '核对并提交' },
    ],
  },
  blocks: [
    // ----------------------------------------------------------------- header
    {
      id: 'nav-main',
      kind: 'nav',
      importance: 'primary',
      region: 'header',
      items: [
        '首页',
        '就业服务',
        '社保服务',
        '网上申领',
        '进度查询',
        '申报材料',
        '表格下载',
        '常见问题',
        '联系我们',
        '无障碍',
        '繁體版',
        '登录',
      ],
    },
    {
      id: 'nav-utility',
      kind: 'nav',
      importance: 'secondary',
      region: 'utility',
      items: ['字号', '打印', '分享', '收藏', '帮助'],
    },
    {
      id: 'promo-app',
      kind: 'promo',
      importance: 'decorative',
      region: 'header',
      complexity: 'simple',
      text: '下载“云溪人社”手机APP，随时查询办理进度、上传材料、接收审核提醒。扫码下载，或在各大应用商店搜索“云溪人社”。',
    },
    {
      id: 'notice-maintenance',
      kind: 'notice',
      importance: 'secondary',
      complexity: 'simple',
      text: '系统维护通知：本平台将于2026年9月20日（星期日）02:00至04:00进行系统维护，期间暂停服务。维护前保存的草稿不受影响。由此带来的不便，敬请谅解。',
    },

    // ------------------------------------------------------------------- body
    {
      id: 'heading-title',
      kind: 'heading',
      level: 1,
      importance: 'primary',
      complexity: 'simple',
      text: '灵活就业人员社会保险补贴——网上申领',
    },
    {
      id: 'image-hero',
      kind: 'image',
      importance: 'decorative',
      src: '/img/hero-rowhouses.svg',
      alt: '街区房屋与树木的插画',
      decorative: true,
    },
    {
      id: 'intro',
      kind: 'text',
      importance: 'primary',
      group: 'start',
      complexity: 'complex',
      text: '灵活就业人员社会保险补贴（以下简称“社保补贴”）是云溪市人力资源和社会保障局依据《云溪市就业补助资金管理办法》设立的就业扶持项目，所需资金由市、区两级就业补助资金列支。经认定的就业困难人员和离校2年内未就业的高校毕业生，以灵活就业形式实现就业并按规定以个人身份缴纳职工基本养老保险费和职工基本医疗保险费的，按其实际缴费额的三分之二给予补贴，补贴期限最长不超过3年；距法定退休年龄不足5年的，可延长至退休。补贴资金经公共就业服务机构审核、公示无异议后，由财政部门通过申领人社会保障卡金融账户拨付。本补贴不得与其他社会保险补贴重复享受，补贴期限自首次享受之月起连续计算。',
      plainText:
        '社保补贴是云溪市人社局的一项就业帮扶政策，钱来自市、区两级的就业补助资金。谁能领：经过认定的就业困难人员，还有毕业不超过2年、没有找到工作的大学毕业生。条件是：你以灵活就业的方式工作，并且自己按规定交了职工养老保险和职工医保。补多少：你实际缴费额的三分之二。补多久：最长3年；离法定退休年龄不到5年的，可以一直补到退休。钱怎么发：公共就业服务机构审核、公示没有异议后，由财政部门拨付到你社保卡的银行账户。注意：这项补贴不能和其他社保补贴同时领；补贴期限从第一次领的那个月起连续计算。',
      terms: [
        { term: '就业困难人员', plain: '经人社部门认定、因年龄、身体、技能等原因难以找到工作的人员。' },
        { term: '灵活就业', plain: '没有固定用人单位，以自雇、临时或兼职等方式工作。' },
        { term: '公示', plain: '把拟补贴的名单公开一段时间，让公众可以提出异议。' },
        { term: '拨付', plain: '把资金正式划转到你的账户。' },
      ],
    },
    {
      id: 'eligibility',
      kind: 'legal',
      importance: 'primary',
      group: 'start',
      complexity: 'complex',
      text: '申领条件。同时符合下列条件的人员，可以申领本补贴：（一）具有本市户籍，或持有本市居住证且在本市连续缴纳社会保险费满6个月；（二）已在户籍地或居住地公共就业服务机构办理灵活就业登记，且登记时间不少于30日；（三）属于经认定的就业困难人员，或离校2年内未就业的高校毕业生；（四）以个人身份在本市缴纳职工基本养老保险费和职工基本医疗保险费，且申领前无欠缴记录；（五）申领当月家庭人均月收入不高于本市最低生活保障标准的2倍（本市现行最低生活保障标准为每人每月1,090元）。享受其他社会保险补贴期间不得重复申领；已领取本补贴累计满36个月的，不再受理。',
      plainText:
        '同时满足这些条件才能申领：你有本市户籍，或者有本市居住证并且在本市连续交了满6个月社保；你已经在公共就业服务机构办了灵活就业登记，登记满30天；你是认定过的就业困难人员，或者毕业不超过2年、还没找到工作的大学毕业生；你以个人身份在本市交职工养老保险和职工医保，申领前没有欠费；你家里的人均月收入不超过本市最低生活保障标准的2倍，现在的最低生活保障标准是每人每月1,090元。正在领其他社保补贴的，不能同时领这一项；这项补贴累计领满36个月的，不再受理。',
      terms: [
        { term: '居住证', plain: '非本市户籍人员在本市登记居住后领到的证件。' },
        { term: '灵活就业登记', plain: '到公共就业服务机构登记你在灵活就业，是享受补贴的前提手续。' },
        { term: '最低生活保障标准', plain: '政府规定的当地基本生活费用线，常说的“低保线”。' },
      ],
    },
    {
      id: 'adjudication',
      kind: 'text',
      importance: 'primary',
      group: 'start',
      complexity: 'complex',
      text: '申请提交后，由申领人户籍地或居住地的区级公共就业服务机构受理并初审，初审通过的报市就业服务中心复核。经办机构可通过系统消息或电话通知申领人补正材料，申领人应自通知之日起5个工作日内完成补正；逾期未补正的，视为放弃本批次申领。复核通过的名单在本平台公示5个工作日，公示无异议的，由财政部门于次月完成资金拨付。对审核结论有异议的，可自结论作出之日起10个工作日内向受理机构提出书面复核申请，逾期不予受理。',
      plainText:
        '你提交后，先由你户籍地或居住地的区级公共就业服务机构初审，通过后再报市就业服务中心复核。如果材料需要补正，经办机构会用系统消息或电话通知你，你要在通知后5个工作日内补齐；超过时间没补，就算你放弃这一批。复核通过的名单会在这个平台上公示5个工作日；没有人提出异议，财政部门会在下个月把钱打给你。如果你不同意审核结果，可以在结果作出后10个工作日内向受理机构书面申请复核；过了时间就不受理了。',
      terms: [{ term: '补正', plain: '按经办机构的要求补交或更正材料。' }],
    },
    {
      id: 'deadline',
      kind: 'deadline',
      importance: 'critical',
      group: 'start',
      date: '2026-10-30',
      text: '本批次补贴实行网上集中受理，申领人应通过本平台提交申请，经办机构按提交先后顺序审核。本批次申领截止时间为2026年10月30日（星期五）17:00，系统届时自动关闭。截止后提交或材料不全的申请，本批次不予受理，申领人可待下一批次公告发布后重新申领。',
      plainText:
        '你必须在2026年10月30日（星期五）17:00之前提交，到点系统会自动关闭。这一批补贴在网上集中受理，经办机构按提交的先后顺序审核。晚交或材料不全的，这一批不受理；等下一批公告发布后，可以再申请。',
    },
    {
      id: 'what-you-need',
      kind: 'instruction',
      importance: 'primary',
      group: 'start',
      complexity: 'complex',
      text: '申领前请准备下列材料。扫描件或照片须清晰完整，单个文件不超过5MB，格式为PDF、JPG或PNG。（1）本人有效居民身份证正反面；（2）灵活就业登记证明，可在“进度查询”栏目下载电子版；（3）就业困难人员认定证明，或毕业证书（离校2年内未就业高校毕业生提供）；（4）以个人身份缴纳社会保险费的缴费凭证，须覆盖申领期内全部月份；（5）家庭收入证明：工资流水、经营收入证明，或无收入承诺书（云人社表-07）。材料不齐或不清晰的，系统不予受理。',
      plainText:
        '开始前先准备好这些材料。扫描件或照片要清楚、完整，每个文件不超过5MB，格式用PDF、JPG或PNG。（1）你的身份证正面和反面；（2）灵活就业登记证明，可以在“进度查询”栏目下载电子版；（3）就业困难人员认定证明；如果你是毕业不超过2年、还没找到工作的大学毕业生，交毕业证书；（4）你自己交社保的缴费凭证，申领期内的每个月都要有；（5）家庭收入证明，比如工资流水、经营收入证明；没有收入的，交无收入承诺书（云人社表-07）。材料不全或看不清的，系统不受理。',
      terms: [
        { term: '缴费凭证', plain: '证明你已经缴纳社保费的单据，可在社保经办机构或手机APP打印。' },
        { term: '承诺书', plain: '由你本人签名、保证所写内容属实的书面声明。' },
      ],
    },
    {
      id: 'image-documents',
      kind: 'image',
      importance: 'primary',
      group: 'start',
      src: '/img/documents-checklist.svg',
      alt: '申领所需五类材料示意：身份证、灵活就业登记证明、认定证明或毕业证书、社保缴费凭证、收入证明',
      decorative: false,
    },

    // ---------------------------------------------------------------- sidebar
    {
      id: 'nav-related',
      kind: 'nav',
      importance: 'secondary',
      region: 'sidebar',
      items: [
        '就业困难人员认定',
        '灵活就业登记',
        '一次性创业补贴',
        '职业培训补贴',
        '社会保险缴费查询',
        '就业补助资金管理办法（PDF）',
        '2026年最低生活保障标准',
        '经办机构地址及电话',
      ],
    },
    {
      id: 'announcement-hours',
      kind: 'text',
      importance: 'secondary',
      region: 'sidebar',
      complexity: 'simple',
      text: '线下办理：各区公共就业服务大厅工作日8:30—11:30、13:30—17:00对外办公；市民服务中心（云溪大道240号）周六上午照常受理。',
    },
    {
      id: 'announcement-access',
      kind: 'text',
      importance: 'secondary',
      region: 'sidebar',
      complexity: 'simple',
      text: '无障碍服务：市民服务中心提供手语翻译和大字版申领指南，有需要的请提前一个工作日致电预约。',
    },
    {
      id: 'announcement-scams',
      kind: 'text',
      importance: 'secondary',
      region: 'sidebar',
      complexity: 'medium',
      text: '防范诈骗提示：人社部门不会以任何名义收取申领费用，也不会要求申领人向个人账户转账。接到可疑电话或短信，请拨打12345反映。',
      plainText: '小心诈骗。人社部门不会收任何申领费用，也不会让你往个人账户转账。接到可疑电话或短信，打12345反映。',
    },
    {
      id: 'promo-rate',
      kind: 'promo',
      importance: 'decorative',
      region: 'sidebar',
      complexity: 'simple',
      text: '本页面对您是否有帮助？请为本次办事体验评分，帮助我们改进政务服务。评价仅需一分钟。',
    },

    // ------------------------------------------------------------------- form
    {
      id: 'heading-form',
      kind: 'heading',
      level: 2,
      importance: 'primary',
      complexity: 'simple',
      text: '申领信息填报',
    },
    {
      id: 'form-instruction',
      kind: 'instruction',
      importance: 'primary',
      group: 'you',
      complexity: 'medium',
      text: '带 * 的为必填项，标注“（必填）”的项目也须填写。身份证号码、性别由实名登录信息自动带入，无需填写。页面20分钟无操作将自动退出，请及时点击“暂存”保存已填内容；填写过程中请勿使用浏览器“后退”按钮。',
      plainText:
        '带 * 或“（必填）”的都必须填。身份证号和性别已经从你的登录信息带入，不用填。20分钟不操作，页面会自动退出，记得点“暂存”保存；填的时候不要按浏览器的“后退”。',
    },

    // 个人信息
    {
      id: 'field-full-name',
      kind: 'field',
      importance: 'critical',
      group: 'you',
      label: '姓名',
      input: 'text',
      required: true,
      help: '请填写与居民身份证一致的姓名；少数民族姓名中的间隔符请使用“·”。',
      plainHelp: '填身份证上的名字。少数民族名字里的分隔点，用“·”这个符号。',
    },
    {
      id: 'field-date-of-birth',
      kind: 'field',
      importance: 'critical',
      group: 'you',
      label: '出生日期',
      input: 'date',
      required: true,
      help: '格式为YYYY-MM-DD。申领人须年满16周岁且未达到法定退休年龄。',
      plainHelp: '按“年-月-日”的格式填。你必须满16周岁，而且还没到法定退休年龄。',
    },
    {
      id: 'field-phone',
      kind: 'field',
      importance: 'critical',
      group: 'you',
      label: '手机号码',
      input: 'tel',
      required: true,
      help: '请填写本人实名登记的11位手机号码，用于接收验证码及补正通知；工作日9:00—17:00经办人员可能致电核实。',
      plainHelp:
        '填你自己实名登记的11位手机号。验证码和补材料的通知都发到这个号；工作日9:00到17:00之间，办事人员可能打电话给你核对。',
    },
    {
      id: 'field-email',
      kind: 'field',
      importance: 'primary',
      group: 'you',
      label: '电子邮箱',
      input: 'email',
      required: false,
      help: '选填。填写后，审核结论及补正通知将同步发送至该邮箱。',
      plainHelp: '可以不填。填了的话，审核结果和补材料的通知也会发到这个邮箱。',
    },

    // 户籍与居住
    {
      id: 'field-street-address',
      kind: 'field',
      importance: 'critical',
      group: 'home',
      label: '现居住地址',
      input: 'text',
      required: true,
      help: '填写至门牌号；与居住证登记地址不一致的，以居住证登记地址为准。',
      plainHelp: '写到门牌号。如果和居住证上登记的地址不一样，按居住证上的填。',
    },
    {
      id: 'field-city-postcode',
      kind: 'field',
      importance: 'critical',
      group: 'home',
      label: '户籍所在区县及邮政编码',
      input: 'text',
      required: true,
      help: '本市户籍填写户口簿登记的区县；非本市户籍填写居住证签发区县。邮政编码为6位数字。',
      plainHelp: '本市户口的，填户口本上的区县；不是本市户口的，填居住证上签发的区县。邮政编码是6位数字。',
    },
    {
      id: 'field-household-size',
      kind: 'field',
      importance: 'critical',
      group: 'home',
      label: '家庭人口数（含本人）',
      input: 'number',
      required: true,
      help: '填写共同生活的家庭成员人数，含本人、配偶及未成年子女；在校就读的成年子女可计入，连续外出超过6个月的不计入。',
      plainHelp:
        '数一数和你一起生活的家人，包括你自己、配偶和未成年子女；还在上学的成年子女也可以算；连续离家超过6个月的不算。',
    },
    {
      id: 'field-residence-type',
      kind: 'field',
      importance: 'critical',
      group: 'home',
      label: '户籍类型',
      input: 'select',
      required: true,
      options: ['本市城镇户籍', '本市农村户籍', '外省市户籍（持本市居住证）', '其他'],
      help: '请按户口簿登记情况选择。非本市户籍人员须持有有效期内的本市居住证。',
      plainHelp: '按户口本上写的选。不是本市户口的，要有还在有效期内的本市居住证。',
    },

    // 收入与缴费
    {
      id: 'field-monthly-income',
      kind: 'field',
      importance: 'critical',
      group: 'income',
      label: '家庭月收入（元）',
      input: 'number',
      required: true,
      help: '填写申领当月共同生活的家庭成员各类收入合计，含工资、经营性收入、养老金、失业保险金及最低生活保障金等，精确到元。',
      plainHelp:
        '把这个月家里所有人的收入加起来填，包括工资、做生意的收入、养老金、失业金、低保金等，填到元，不用写小数。',
    },
    {
      id: 'field-income-source',
      kind: 'field',
      importance: 'critical',
      group: 'income',
      label: '主要收入来源',
      input: 'select',
      required: true,
      options: [
        '灵活就业收入',
        '个体经营收入',
        '家庭成员工资',
        '养老金或退休金',
        '失业保险金',
        '最低生活保障金',
        '无固定收入',
        '其他',
      ],
      help: '选择占家庭收入比重最大的一项。',
      plainHelp: '选家里收入最主要的那一项。',
    },
    {
      id: 'field-proof-of-income',
      kind: 'field',
      importance: 'critical',
      group: 'income',
      label: '收入及缴费证明材料',
      input: 'file',
      required: true,
      help: '上传近3个月的收入证明及以个人身份缴纳社会保险费的缴费凭证；无收入的上传无收入承诺书（云人社表-07）。支持PDF、JPG、PNG格式，单个文件不超过5MB。',
      plainHelp:
        '上传最近3个月的收入证明，还有你自己交社保的缴费凭证。没有收入的，上传无收入承诺书（云人社表-07）。文件要PDF、JPG或PNG格式，每个不超过5MB。',
    },
    {
      id: 'field-hardship-statement',
      kind: 'field',
      importance: 'primary',
      group: 'income',
      label: '就业困难情况说明',
      input: 'text',
      required: false,
      help: '选填。简要说明本人就业困难的原因（如年龄偏大、身体状况、技能不足等）及目前灵活就业的具体内容，不超过500字。',
      plainHelp:
        '可以不填。简单说说你为什么不好找工作，比如年纪偏大、身体原因、技能不够，再说说你现在具体做什么灵活就业。最多500字。',
    },

    // 核对并提交
    {
      id: 'decision-share-data',
      kind: 'decision',
      importance: 'primary',
      group: 'review',
      label:
        '本人同意云溪市人力资源和社会保障局将本人申领信息共享给合作机构（含金融机构、培训机构及社会服务组织），用于向本人推荐相关就业服务及产品。',
      plainLabel:
        '你允许人社局把你的申领信息交给合作单位，包括银行、培训机构和社会服务组织，他们可能联系你推荐服务或产品。这一项可以不勾。',
      optional: true,
      preChecked: true,
      consequence:
        '勾选后，你的姓名、联系方式和本次申领的信息可能被提供给与人社局合作的机构，这些机构可能与你联系。这一项是可选的，勾不勾都不影响补贴审核。',
    },
    {
      id: 'decision-attest',
      kind: 'decision',
      importance: 'critical',
      group: 'review',
      label:
        '本人承诺以上填报信息及所提交材料真实、准确、完整，如有虚假，愿承担相应法律责任，并全额退回已领取的补贴资金。',
      plainLabel:
        '你保证填的内容和交的材料都是真实、准确、完整的。如果有假，你要承担法律责任，并把已经领到的补贴全部退回。提交前必须勾选这一项。',
      optional: false,
      preChecked: false,
    },
    {
      id: 'privacy-notice',
      kind: 'legal',
      importance: 'critical',
      region: 'footer',
      group: 'review',
      complexity: 'complex',
      text: '隐私声明。本页面收集的个人信息依据《云溪市就业补助资金管理办法》（云人社规〔2024〕3号）用于灵活就业人员社会保险补贴的资格审核、资金拨付及统计分析。申领人可自愿提供，但未提供必要信息的，可能无法通过审核。申领记录及佐证材料自作出审核结论之日起保存10年，期满后按规定销毁。为办理补贴，相关信息可能向财政部门、社会保险经办机构、开户银行及审计机关提供，或依法律法规规定向其他部门提供。申领人可向市人力资源和社会保障局信息保护工作机构申请查阅或更正本人信息。',
      plainText:
        '人社局收集这些信息，依据是《云溪市就业补助资金管理办法》（云人社规〔2024〕3号），用途是审核你的补贴资格、发放补贴和做统计。你可以不提供，但不提供必要信息，可能审核不通过。你的申领记录和佐证材料会从审核结论作出那天起保存10年，到期后销毁。为了办理补贴，你的信息可能提供给财政部门、社保经办机构、你的开户银行和审计机关；法律法规有规定的，也可能提供给其他部门。你可以向市人社局负责信息保护的机构申请查看或更正自己的信息。',
      terms: [{ term: '佐证材料', plain: '用来证明你填报内容属实的材料，比如凭证、证书和证明。' }],
    },
    {
      id: 'action-save-draft',
      kind: 'action',
      importance: 'primary',
      group: 'review',
      label: '暂存',
      primary: false,
    },
    {
      id: 'action-submit',
      kind: 'action',
      importance: 'critical',
      group: 'review',
      label: '提交申请',
      primary: true,
    },
    {
      id: 'action-download-pdf',
      kind: 'action',
      importance: 'secondary',
      group: 'review',
      label: '下载PDF',
      primary: false,
    },
    {
      id: 'action-chat',
      kind: 'action',
      importance: 'decorative',
      label: '在线客服',
      primary: false,
    },

    // -------------------------------------------------------------------- faq
    {
      id: 'faq-eligible',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'medium',
      text: '问：哪些人可以申领？ 答：经认定的就业困难人员，以及离校2年内未就业的高校毕业生，以灵活就业形式实现就业并以个人身份缴纳职工基本养老保险费和职工基本医疗保险费的，可以申领。由用人单位缴纳社会保险费的人员不在申领范围。',
      plainText:
        '问：谁可以申领？ 答：认定过的就业困难人员，以及毕业不超过2年、还没找到工作的大学毕业生。你要以灵活就业的方式工作，并且自己以个人身份交职工养老保险和职工医保。由单位交社保的人不能申领。',
    },
    {
      id: 'faq-timeline',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'complex',
      text: '问：审核需要多长时间？ 答：自受理之日起，区级初审一般在10个工作日内完成，市级复核在初审通过后5个工作日内完成，公示期为5个工作日，补正材料所用时间不计入。复核通过且公示无异议的，补贴资金于次月25日前拨付至申领人社会保障卡金融账户。',
      plainText:
        '问：审核要多久？ 答：受理后，区里初审一般10个工作日内完成；通过后，市里复核5个工作日内完成；然后公示5个工作日。等你补材料的时间不算在内。复核通过、公示没有异议的，钱会在下个月25日前打到你社保卡的银行账户。',
      terms: [{ term: '工作日', plain: '周一到周五，不包括法定节假日。' }],
    },
    {
      id: 'faq-coverage',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'complex',
      text: '问：补贴标准是多少？ 答：按申领人以个人身份实际缴纳的职工基本养老保险费和职工基本医疗保险费之和的三分之二计算，不含大病医疗互助、滞纳金及补缴部分；月补贴额以本市上年度全口径城镇单位就业人员平均工资的60%为缴费基数计算的应缴费额的三分之二为上限。补贴按季度发放。',
      plainText:
        '问：能补多少钱？ 答：补贴是你自己交的职工养老保险费加职工医保费的三分之二。大病医疗互助、滞纳金和补交的部分不算。每个月的补贴有上限：按本市上年度平均工资的60%当作缴费基数，算出应交的费用，它的三分之二就是上限。补贴每个季度发一次。',
    },
    {
      id: 'faq-save-draft',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'simple',
      text: '问：可以先保存，以后再接着填吗？ 答：可以。填写过程中随时点击“暂存”，草稿保留30天；用同一账号登录后可以继续填写。',
    },
    {
      id: 'faq-obstacle',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'complex',
      text: '问：申领期内社会保险费中断缴纳或存在欠费，如何处理？ 答：补贴以实际缴费月份为准，中断月份不予补贴，补贴期限亦不顺延。申领前存在欠费的，须先行补缴并取得缴费凭证后再行申领，补缴部分不纳入补贴范围。申领期内被用人单位录用并由单位缴纳社会保险费的，自录用次月起停止享受补贴，并应于30日内向经办机构报告。',
      plainText:
        '问：申领期间社保断缴或者有欠费，怎么办？ 答：补贴只看你实际交了费的月份。哪个月没交，那个月就没有补贴，补贴期限也不会往后顺延。申领前有欠费的，先把欠费补上、拿到缴费凭证，再来申领；补交的那部分不能领补贴。申领期间如果你被单位录用、由单位交社保了，从录用的下个月起就不能再领，而且要在30天内告诉经办机构。',
    },
    {
      id: 'faq-denied',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'complex',
      text: '问：审核未通过怎么办？ 答：审核结论及未通过原因将通过系统消息和短信告知申领人。对结论有异议的，可自结论作出之日起10个工作日内向受理机构提出书面复核申请；复核以原提交材料为依据，不再受理新增材料。复核维持原结论的，本批次不再受理同一事项的申领。',
      plainText:
        '问：审核没通过怎么办？ 答：系统消息和短信会告诉你结果和原因。不服的话，从结果作出那天起10个工作日内，向受理机构书面申请复核。复核只看你原来交的材料，不能再补新的。复核还是没通过，这一批就不能再申请同一件事了。',
    },

    // ----------------------------------------------------------------- footer
    {
      id: 'nav-footer',
      kind: 'nav',
      importance: 'secondary',
      region: 'footer',
      items: ['关于本站', '隐私政策', '使用条款', '无障碍声明', '政府信息公开', '网站地图'],
    },
  ],
};
