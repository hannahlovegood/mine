# PITCH.md — Mine, 3 minutes

The demo carries the pitch. Talk over what is on screen; never describe something that is not visible. Practise with `?demo=1` so your hands only press numbers.

## Script (2:50, leaves 10 s of silence for the last line)

**0:00 — Hook** (key `1`, the portal is on screen)
EN: Every interface imagines a reader. This one imagined someone with time, perfect attention, and patience for jargon.
中文：每个界面都预设了一位读者。这个页面预设的读者，有时间、注意力完美、还耐得住术语。

**0:20 — The problem**
EN: It passes the automated accessibility checks — zero violations. Now find the deadline. It's in paragraph four. And at the bottom of the form there's something you've already agreed to.
中文：它通过了自动化无障碍检测，零违规。现在请找一下截止日期——在第四段。表单底部还有一项你"已经同意"的东西。
(Pause two seconds. Let them look.)

**0:45 — Make it mine** (key `2`; wait for the morph and the colophon counts)
EN: Twelve fields became five steps. The deadline moved to the top. Eight things were set aside — none of them critical, and here is the list. And one choice was surfaced: this consent to share your data was pre-checked. It's optional. We didn't uncheck it. We made sure you saw it.
中文：十二个填写项变成五步，截止日期移到最上面，收起了八项——没有一项是关键信息，清单在这里。还有一个选择被揭示出来：这项数据共享授权原本是默认勾选的，它是可选的。我们没有替你取消勾选，我们只是确保你看见了它。

**1:30 — My words** (key `3` prefills the text, key `4` applies it)
EN: Now tell it how the page should feel. "I get overwhelmed by long forms. Use plain words, explain anything I might not know, and give me one decision at a time." It turned my words into a configuration — and it tells me why: "one decision at a time" became one task per step. Everything in blue is something it changed, and everything in blue can be undone.
中文：现在告诉它，你希望这个页面是什么感觉。"长表单让我喘不过气。用大白话，解释我可能不懂的词，一次只让我做一个决定。"它把我的话变成了一份配置，而且告诉我为什么："一次一个决定"变成了每步一件事。所有蓝色的地方都是它改过的，所有蓝色的地方都能撤回。

**2:05 — Change your mind** (key `5`, hold, release; then Back to original)
EN: Nothing is decided for you. Nothing is lost. Freedom includes the right to change your mind.
中文：没有任何决定是替你做的，也没有任何东西丢失。自由包括改变主意的权利。

**2:20 — Honesty and roadmap**
EN: Today the page is described in our block schema, and the engine is tested against invariants: a critical block cannot disappear, a number cannot change in plain language. The hard problem is extracting that schema from any real page — that's the browser extension we build next, with the same invariants.
中文：今天这个页面是用我们的块结构描述的；引擎有不变量测试：关键信息不会消失，数字在平实版里不会变。真正难的是从任意真实页面抽出这套结构——那是我们下一步要做的浏览器扩展，用同一套不变量。

**2:40 — Why us, and close** (key `6`)
EN: This is Mine. [One sentence in your own words — see "Why us" below.] Accessibility gives you access. Freedom gives you control.
中文：这就是「由我」。[一句你自己的话。] 无障碍给你入口，自由给你掌控。

If the model call fails on stage: the badge will read "Interpreted offline". Say: "The network dropped — this is the offline interpreter. Same behaviour, and the reasons are still here." Then continue.

## Why us (write your own sentence; two starting points)

- 我是文学出身，习惯把界面当文本读——每个界面都在讲述它想象中的读者是谁。过去一年我在无障碍/手语和面向注意力挑战人群的 AI 教练产品里工作，见过太多"默认界面本身就是障碍"的人。
- EN: I read interfaces the way I was trained to read texts — every one of them tells you who it imagines you are. For the past year I've worked on accessibility and on an AI coach for people with attention challenges; the default interface is the obstacle for most of them.

Decide beforehand whether you name your employer and Synora. Naming the domain is enough; naming the companies is optional.

## Likely questions

1. **这不就是无障碍 overlay 吗？** Overlay 是网站主装给自己的合规护身符：用户看不到它改了什么，也不能拒绝它。我们在读者这一侧，从不替网站宣称合规，每一处改动都列出来、都能撤回。EN soundbite: *An overlay works for the site owner. This works for the reader.*
2. **浏览器阅读模式 / Immersive Reader 早就有了。** 它们解决"读"，我们解决"办"：表单、决定、截止日期、被预勾选的授权。阅读模式不会告诉你这个页面要你做两个决定。*Reader mode was built for reading. This is reader mode for deciding.*
3. **能用在真实网站上吗？** 现在不能；今天的页面用我们的块结构描述。把任意 DOM 抽成这套结构（可读性启发式 + 表单识别 + 模型分类）是下一步，也是真正的难题。先把引擎和不变量做对，是为了让那一步不会破坏"永不删关键信息"的承诺。
4. **简化文本可信吗？** 简化在构建期生成、人工校对；引擎有测试：任何数字、日期、金额在平实版里必须原样出现；法律文本从不替换，只并列摘要；每段改写都标蓝、一键看原文。
5. **为什么不用 AI agent 直接替用户填？** 委托不等于自主。Agent 替你做，你仍然不知道自己同意了什么。我们改的是界面，不是替你做决定——这正是"自由"这个主题的选择：把人留在驾驶座上，换掉座椅。*Delegation is not autonomy.*
6. **谁会用，怎么落地？** 用户侧：浏览器扩展，先做政务、银行、医疗这些高压场景；机构侧：作为 SDK 给公共服务网站提供"合身版"。政策面可引用（**上台前核实日期**）：中国工信部互联网应用适老化及无障碍改造专项行动（2020 年底启动）；美国 ADA Title II 网页规则（2024 年发布，2026/2027 分批达标）；欧盟无障碍法案 EAA（2025 年 6 月起适用）。核心论点：合规不等于可用。
7. **有用户测试吗？** 诚实回答。赛前如果能找 2–3 个人（注意力困难、读写障碍、长辈）做 10 分钟走查，把其中一句原话放进 pitch，分量远超任何指标。
8. **最难的技术问题？** 一是把任意页面变成块结构、同时保证关键信息不丢；二是"改动可解释"本身——日志必须从真实 diff 算出来，而不是写出来的。
9. **和你另一个项目是什么关系？**（如果被问）Focus 模式服务的正是同一群人。它是一个独立实验；如果成立，可以成为那个产品的一项能力。
10. **商业模式？** 现阶段的诚实答案：先证明"用户侧的界面主权"能被做出来并且被人要；付费方最可能是机构（政务、银行、保险、医疗）而不是读者。

## One-liners

- The interface is not neutral. / 界面从不中立。
- Make it mine. The button is the product. / 变成我的——按钮就是产品。
- Same information. Your edition. / 同一份信息，属于你的版本。
- If it's blue, we changed it — and you can undo it. / 蓝色的地方都是我们改过的，也都能撤回。
- Reader mode for deciding.
- Delegation is not autonomy. / 委托不等于自主。
- Access is not enough. Control is. / 能进入还不够，能掌控才算数。

## Setup, 30 minutes before

- `npm run demo` running from localhost; one full offline run-through done.
- One real interpreter call succeeded with the key.
- Phone hotspot on; backup video open in a second window; timer visible.
- Reduced motion off, zoom 100%, no other tabs, notifications off.
- `?demo=1` keys tested 1 → 6 → r.
