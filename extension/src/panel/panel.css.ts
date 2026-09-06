import { TOKENS } from '../apply/css.ts';

// Targets: ≥ 44 px everywhere, ≥ 48 px while the page is in Large (the host carries data-large then).
export const PANEL_CSS = `
:host { ${TOKENS} all: initial; --target: 44px; font-family: var(--font-interface); font-size: 14px; line-height: 1.45; color: var(--ink); }
:host([data-large]) { --target: 48px; }
* { box-sizing: border-box; }
button, input, select, textarea { font: inherit; }
:focus-visible { outline: 3px solid var(--pencil); outline-offset: 2px; }
.fab { position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; min-height: max(46px, var(--target)); padding: 0 18px 0 14px; border-radius: 23px; border: 1px solid var(--ink); background: var(--paper); color: var(--ink); font-weight: 700; font-size: 15px; cursor: pointer; display: inline-flex; align-items: center; gap: 10px; box-shadow: 0 1px 0 var(--rule), 0 6px 20px rgba(0,0,0,0.12); }
.fab[hidden] { display: none; }
.fab:hover { background: var(--stub); }
.fab .m { display: inline-block; width: 14px; height: 14px; border-bottom: 3px solid var(--pencil); }
.fab[data-active] { background: var(--ink); color: var(--paper); }
.fab[data-active] .m { border-bottom-color: var(--pencil); }
.rail { position: fixed; top: 0; right: 0; bottom: 0; width: 360px; max-width: 100vw; z-index: 2147483001; background: var(--paper); border-left: 1px solid var(--rule); box-shadow: -8px 0 30px rgba(0,0,0,0.08); display: flex; flex-direction: column; transform: translateX(100%); transition: transform 150ms ease-out; }
.rail[data-open] { transform: none; }
.rail[data-parked] { visibility: hidden; }
@media (max-width: 720px) { .rail { top: auto; left: 0; width: 100%; max-height: 80vh; border-left: 0; border-top: 1px solid var(--ink); transform: translateY(100%); } }
@media (prefers-reduced-motion: reduce) { .rail { transition: none; } }
.head { display: flex; align-items: center; gap: 6px; padding: 10px 12px 8px 18px; border-bottom: 1px solid var(--rule); }
.head .brand { font-family: var(--font-edition); font-size: 20px; font-weight: 500; letter-spacing: -0.01em; margin: 0; }
.head .brand small { font-family: var(--font-interface); font-size: 12px; color: var(--graphite); margin-left: 8px; font-weight: 400; }
.head .spacer { flex: 1; }
.iconbtn { background: none; border: 0; min-width: var(--target); min-height: var(--target); padding: 0 6px; cursor: pointer; color: var(--ink); font-size: 15px; border-radius: 2px; }
.iconbtn:hover { background: var(--stub); }
.body { overflow: auto; padding: 12px 18px 24px; display: flex; flex-direction: column; gap: 16px; }
.modes { display: flex; flex-wrap: wrap; gap: 2px; }
.modes button { position: relative; display: inline-flex; align-items: center; min-height: var(--target); padding: 0 9px; cursor: pointer; font-size: 15px; color: var(--graphite); background: none; border: 0; border-bottom: 2px solid transparent; border-radius: 2px 2px 0 0; }
.modes button:hover { color: var(--ink); }
.modes button[aria-pressed='true'] { border-bottom-color: var(--ink); color: var(--ink); }
.modes button[aria-disabled='true'] { cursor: progress; opacity: 0.6; }
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
.link { background: none; border: 0; padding: 0 2px; color: var(--pencil); text-decoration: underline; text-underline-offset: 0.18em; cursor: pointer; min-height: var(--target); display: inline-flex; align-items: center; }
.link:hover { text-decoration-thickness: 2px; }
.decisions ul { list-style: none; margin: 0; padding: 0; }
.decisions li { padding: 8px 0; border-top: 1px dotted var(--rule); }
.decisions li:first-child { border-top: 0; }
.decisions .flag { display: block; color: var(--graphite); }
.decisions .flag.pre { color: var(--pencil); }
.why ul { list-style: none; margin: 0; padding: 0; }
.why li { padding: 3px 0; }
.badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--graphite); border: 1px solid var(--graphite); border-radius: 12px; padding: 2px 9px; margin-top: 8px; }
.badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--rule); }
.badge[data-source='model']::before { background: var(--pencil); }
textarea { width: 100%; min-height: 84px; padding: 8px 10px; border: 1px solid var(--ink); border-radius: 2px; resize: vertical; font-size: 15px; line-height: 1.45; background: var(--paper); color: var(--ink); }
.hint { font-size: 12px; color: var(--graphite); margin: 4px 0 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px; }
.chip { min-height: var(--target); padding: 0 12px; border: 1px solid var(--graphite); border-radius: 22px; background: var(--paper); color: var(--ink); cursor: pointer; font-size: 13px; }
.chip:hover { border-color: var(--ink); }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.btn { min-height: var(--target); padding: 0 18px; border-radius: 2px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); font-weight: 700; font-size: 15px; cursor: pointer; }
.btn.secondary { background: var(--paper); color: var(--ink); }
.btn:disabled, .btn[aria-disabled='true'] { opacity: 0.4; cursor: default; }
.hold { min-height: max(46px, var(--target)); border: 1px solid var(--pencil); color: var(--pencil); background: var(--paper); border-radius: 2px; padding: 0 14px; cursor: pointer; text-align: left; user-select: none; -webkit-user-select: none; touch-action: none; font-size: 15px; }
.hold[aria-pressed='true'] { background: var(--pencil); color: var(--paper); }
.hold:disabled, .reset:disabled { opacity: 0.4; cursor: default; }
.reset { min-height: var(--target); border: 0; background: none; color: var(--pencil); text-decoration: underline; text-underline-offset: 0.2em; cursor: pointer; text-align: left; padding: 0 2px; font-size: 15px; }
.actions { display: flex; flex-direction: column; gap: 6px; }
.settings summary { cursor: pointer; font-size: 13px; font-weight: 700; color: var(--graphite); min-height: var(--target); display: flex; align-items: center; }
.settings label { display: block; font-size: 13px; color: var(--graphite); margin-top: 8px; }
.settings input[type=text], .settings select { width: 100%; min-height: var(--target); padding: 6px 8px; border: 1px solid var(--graphite); border-radius: 2px; margin-top: 4px; background: var(--paper); color: var(--ink); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.pencil { color: var(--pencil); }
.stepnav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.stepnav .btn { padding: 0 12px; font-size: 14px; }
`;
