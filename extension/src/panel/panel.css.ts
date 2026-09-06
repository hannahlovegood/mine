import { TOKENS } from '../apply/css.ts';

export const PANEL_CSS = `
:host { ${TOKENS} all: initial; font-family: var(--font-interface); font-size: 14px; line-height: 1.45; color: var(--ink); }
* { box-sizing: border-box; }
button, input, select, textarea { font: inherit; }
.fab { position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; min-height: 46px; padding: 0 18px 0 14px; border-radius: 23px; border: 1px solid var(--ink); background: var(--paper); color: var(--ink); font-weight: 700; font-size: 15px; cursor: pointer; display: inline-flex; align-items: center; gap: 10px; box-shadow: 0 1px 0 var(--rule), 0 6px 20px rgba(0,0,0,0.12); }
.fab:hover { background: var(--stub); }
.fab .m { display: inline-block; width: 14px; height: 14px; border-bottom: 3px solid var(--pencil); }
.fab[data-active] { background: var(--ink); color: var(--paper); }
.fab[data-active] .m { border-bottom-color: var(--pencil); }
.rail { position: fixed; top: 0; right: 0; bottom: 0; width: 360px; max-width: 100vw; z-index: 2147483001; background: var(--paper); border-left: 1px solid var(--rule); box-shadow: -8px 0 30px rgba(0,0,0,0.08); display: flex; flex-direction: column; transform: translateX(100%); transition: transform 150ms ease-out; }
.rail[data-open] { transform: none; }
@media (max-width: 720px) { .rail { top: auto; left: 0; width: 100%; max-height: 80vh; border-left: 0; border-top: 1px solid var(--ink); transform: translateY(100%); } }
.head { display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px; border-bottom: 1px solid var(--rule); }
.head .brand { font-family: var(--font-edition); font-size: 20px; font-weight: 500; letter-spacing: -0.01em; }
.head .brand small { font-family: var(--font-interface); font-size: 12px; color: var(--graphite); margin-left: 8px; font-weight: 400; }
.head .spacer { flex: 1; }
.iconbtn { background: none; border: 0; min-width: 40px; min-height: 40px; cursor: pointer; color: var(--ink); font-size: 15px; border-radius: 2px; }
.iconbtn:hover { background: var(--stub); }
.body { overflow: auto; padding: 12px 18px 24px; display: flex; flex-direction: column; gap: 16px; }
.modes { display: flex; flex-wrap: wrap; gap: 2px; }
.modes label { position: relative; display: inline-flex; align-items: center; min-height: 40px; padding: 0 9px; cursor: pointer; font-size: 15px; color: var(--graphite); border-bottom: 2px solid transparent; }
.modes label:hover { color: var(--ink); }
.modes input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.modes label:has(input:checked) { border-bottom-color: var(--ink); color: var(--ink); }
.modes label:has(input:focus-visible) { outline: 3px solid var(--pencil); outline-offset: -3px; }
.desc { color: var(--graphite); font-size: 13px; margin: 4px 0 0; }
h2 { font-family: var(--font-edition); font-size: 20px; font-weight: 500; margin: 0; }
h3 { font-size: 13px; font-weight: 700; color: var(--graphite); margin: 0 0 6px; }
section { border-top: 1px solid var(--rule); padding-top: 12px; }
.summary { font-family: var(--font-edition); font-size: 16px; line-height: 1.5; margin: 6px 0 0; }
.summary b { font-weight: 600; }
.status { color: var(--graphite); }
.notice { color: var(--graphite); border-left: 2px solid var(--rule); padding-left: 10px; }
.changes { list-style: none; margin: 0; padding: 0; }
.changes li { padding: 8px 6px; margin: 0 -6px; border-radius: 2px; }
.changes li:hover { background: var(--pencil-soft); }
.changes .head2 { display: flex; justify-content: space-between; gap: 8px; }
.changes .type { font-weight: 700; }
.changes .count { color: var(--graphite); }
.changes .reason { color: var(--graphite); margin: 2px 0 0; }
.changes .names { margin: 2px 0 0; }
.link { background: none; border: 0; padding: 0; color: var(--pencil); text-decoration: underline; text-underline-offset: 0.18em; cursor: pointer; min-height: 32px; display: inline-flex; align-items: center; }
.link:hover { text-decoration-thickness: 2px; }
.decisions ul { list-style: none; margin: 0; padding: 0; }
.decisions li { padding: 8px 0; border-top: 1px dotted var(--rule); }
.decisions li:first-child { border-top: 0; }
.decisions .flag { display: block; color: var(--graphite); }
.decisions .flag.pre { color: var(--pencil); }
.why ul { list-style: none; margin: 0; padding: 0; }
.why li { padding: 3px 0; }
.badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--graphite); border: 1px solid var(--rule); border-radius: 12px; padding: 2px 9px; margin-top: 8px; }
.badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--rule); }
.badge[data-source='model']::before { background: var(--pencil); }
textarea { width: 100%; min-height: 84px; padding: 8px 10px; border: 1px solid var(--ink); border-radius: 2px; resize: vertical; font-size: 15px; line-height: 1.45; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px; }
.chip { min-height: 32px; padding: 0 10px; border: 1px solid var(--rule); border-radius: 16px; background: var(--paper); cursor: pointer; font-size: 13px; }
.chip:hover { border-color: var(--ink); }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.btn { min-height: 42px; padding: 0 18px; border-radius: 2px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); font-weight: 700; font-size: 15px; cursor: pointer; }
.btn.secondary { background: var(--paper); color: var(--ink); }
.btn:disabled { opacity: 0.4; cursor: default; }
.hold { min-height: 46px; border: 1px solid var(--pencil); color: var(--pencil); background: var(--paper); border-radius: 2px; padding: 0 14px; cursor: pointer; text-align: left; user-select: none; -webkit-user-select: none; touch-action: none; font-size: 15px; }
.hold[aria-pressed='true'] { background: var(--pencil); color: var(--paper); }
.hold:disabled, .reset:disabled { opacity: 0.4; cursor: default; }
.reset { min-height: 40px; border: 0; background: none; color: var(--pencil); text-decoration: underline; text-underline-offset: 0.2em; cursor: pointer; text-align: left; padding: 0; font-size: 15px; }
.actions { display: flex; flex-direction: column; gap: 6px; }
.settings summary { cursor: pointer; font-size: 13px; font-weight: 700; color: var(--graphite); min-height: 32px; display: flex; align-items: center; }
.settings label { display: block; font-size: 13px; color: var(--graphite); margin-top: 8px; }
.settings input[type=text], .settings select { width: 100%; min-height: 38px; padding: 6px 8px; border: 1px solid var(--rule); border-radius: 2px; margin-top: 4px; }
.settings .hint { font-size: 12px; color: var(--graphite); margin: 4px 0 0; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.pencil { color: var(--pencil); }
.stepnav { display: flex; gap: 8px; align-items: center; }
.stepnav .btn { min-height: 36px; padding: 0 12px; font-size: 14px; }
`;
