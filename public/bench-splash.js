/*
 * bench-splash.js — Copyright (c) 2026 Todd Boswell, toddboswell.com
 * Free software under the GNU AGPL v3 (see LICENSE). Keep this notice and
 * the author credit intact in copies and modified versions (AGPL §5, §7(b)).
 */
/* bench-splash.js — the first-open screen shared by Mr. Todd's tools.
 *
 * One file, no dependencies. Drop it in with a <script> tag and call
 * BenchSplash.open({...}) once the app has booted. The screen offers three
 * doors — a template, a blank document, or an existing file — plus whatever
 * the app can recover (autosave, recent projects). Colors come from the same
 * vibe tokens as toddboswell.com (todd-vibe.css), and when the app runs on
 * that origin it follows the vibe the visitor already picked.
 *
 * API
 *   BenchSplash.open(config)  -> handle { close(), el } or null when skipped
 *   BenchSplash.isSkipped(key) / BenchSplash.setSkipped(key, bool)
 *   BenchSplash.kewpie        -> data: URI of the mark, for app chrome
 *   BenchSplash.mark(size)    -> an <img> element of the mark
 *   BenchSplash.lift()        -> remove the boot veil (called by open(); call it yourself if you skip open())
 *   BenchSplash.help(config)  -> the Help panel (shortcuts, tips, about); handle { close(), el }
 *      { name, eyebrow, tagline, vibe, followSiteVibe, homeUrl, section: 'shortcuts'|'tips'|'about',
 *        shortcuts: [{ scope, keys, label }], tips: ['...'], about: ['...'], links: [{label, href}],
 *        version, onStartScreen: fn }
 *
 * config
 *   key        'sketchpad'            storage key suffix (required)
 *   name       'Sketchpad'            the tool's one-word name
 *   eyebrow    "Mr. Todd's"           family name above it
 *   tagline    'Paint in layers…'     one plain line
 *   vibe       'darkroom'|'midwest'|'brutalist'|'retrowave'   default look
 *   followSiteVibe  true              honor localStorage 'todd-vibe' if set
 *   homeUrl    'https://toddboswell.com'
 *   templates  [{ name, meta, thumb, run }]   thumb: inline SVG markup or a URL
 *   moreTemplates  fn                  optional "All templates" link
 *   sizes      [{ label, run }]         blank-document presets
 *   primary    { label, run }           the big button in the Blank card
 *   open       { hint, formats, browse: fn, files: fn(FileList) }
 *   recent     [{ name, meta, run }] | Promise of the same
 *   footer     'Nothing leaves the browser.'
 *   force      true to show even when the visitor ticked "skip"
 *   onClose    fn(reason)  'template'|'blank'|'open'|'recent'|'skip'|'escape'
 */
(function (global) {
  'use strict';

  var KEWPIE = 'data:image/png;base64,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';

  var VIBES = {
    darkroom:  { bg:'#0a0a0a', surface:'#141414', raised:'#1c1c1c', hover:'#242424', text:'#e8e6e3', muted:'#8a8580', faint:'#5a5550', accent:'#c4a35a', soft:'rgba(196,163,90,0.10)', glow:'rgba(196,163,90,0.25)', border:'rgba(232,230,227,0.07)', strong:'rgba(232,230,227,0.15)' },
    midwest:   { bg:'#f5f2ed', surface:'#ebe7e0', raised:'#e0dbd2', hover:'#d5cfc5', text:'#1a1a1a', muted:'#6b6560', faint:'#9a9590', accent:'#8b4513', soft:'rgba(139,69,19,0.08)',  glow:'rgba(139,69,19,0.15)',  border:'rgba(26,26,26,0.08)',    strong:'rgba(26,26,26,0.15)' },
    brutalist: { bg:'#ffffff', surface:'#f0f0f0', raised:'#e0e0e0', hover:'#d0d0d0', text:'#000000', muted:'#666666', faint:'#999999', accent:'#ff0000', soft:'rgba(255,0,0,0.08)',     glow:'rgba(255,0,0,0.15)',     border:'#000000',                strong:'#000000' },
    retrowave: { bg:'#0f0518', surface:'#1a0b2e', raised:'#240e42', hover:'#2e1456', text:'#f0e6ff', muted:'#b8a0d0', faint:'#8060a0', accent:'#ff00a0', soft:'rgba(255,0,160,0.10)',   glow:'rgba(255,0,160,0.25)',   border:'rgba(240,230,255,0.08)', strong:'rgba(240,230,255,0.15)' }
  };

  var STYLE_ID = 'bench-splash-style';
  var css = [
    '.bench-splash{position:fixed;inset:0;z-index:99990;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:var(--bs-bg);color:var(--bs-text);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:16px;line-height:1.5;',
      'display:flex;flex-direction:column;overflow:auto;-webkit-font-smoothing:antialiased;box-sizing:border-box}',
    '.bench-splash *,.bench-splash *::before,.bench-splash *::after{box-sizing:border-box}',
    '.bench-splash a{color:var(--bs-accent);text-decoration:none}.bench-splash a:hover{opacity:.75}',
    '.bench-splash button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}',
    '.bench-splash .bs-mono{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace}',
    '.bench-splash .bs-disp{font-family:Georgia,"Times New Roman",serif;font-style:italic}',
    '.bench-splash .bs-label{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10.4px;letter-spacing:.2em;text-transform:uppercase;color:var(--bs-accent)}',
    '.bench-splash .bs-label.faint{color:var(--bs-faint)}',
    '.bs-bar{display:flex;align-items:center;justify-content:space-between;padding:0 48px;height:56px;border-bottom:1px solid var(--bs-border);flex-shrink:0}',
    '.bs-brand{display:flex;align-items:center;gap:12px;font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:12px;letter-spacing:.08em}',
    '.bs-brand img{width:22px;height:22px;display:block}.bs-brand span{color:var(--bs-muted)}',
    '.bs-bar-right{display:flex;align-items:center;gap:12px}',
    '.bs-bar-right a,.bs-bar-right button{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:9.6px;letter-spacing:.1em;text-transform:uppercase;color:var(--bs-muted)}',
    '.bs-bar-right button{border:1px solid var(--bs-strong);border-radius:4px;padding:5.6px 11.2px;transition:.2s ease}',
    '.bs-bar-right button:hover{border-color:var(--bs-accent);color:var(--bs-accent)}',
    '.bs-body{flex:1 0 auto;display:grid;grid-template-columns:380px minmax(0,1fr);gap:64px;padding:56px 48px 40px;align-content:start}',
    '.bs-intro{display:flex;flex-direction:column;min-height:0}',
    '.bs-name{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:56px;line-height:1.05;letter-spacing:-.01em;margin-top:20px;color:var(--bs-text)}',
    '.bs-tag{font-size:15px;line-height:1.6;color:var(--bs-muted);margin-top:18px;max-width:320px;text-wrap:pretty}',
    '.bs-recent{margin-top:48px;display:flex;flex-direction:column}',
    '.bs-recent-list{margin-top:8px;display:flex;flex-direction:column}',
    '.bs-recent button{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:12px 0;border-top:1px solid var(--bs-border);width:100%;transition:.2s ease}',
    '.bs-recent button:hover .bs-disp{color:var(--bs-accent)}',
    '.bs-recent .bs-disp{font-size:16px;color:var(--bs-text);transition:.2s ease}',
    '.bs-recent .bs-mono{font-size:10px;color:var(--bs-faint);letter-spacing:.04em;white-space:nowrap}',
    '.bs-skip{margin-top:auto;padding-top:32px;display:flex;align-items:center;gap:10px;font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10px;letter-spacing:.04em;color:var(--bs-faint);cursor:pointer;user-select:none}',
    '.bs-skip input{appearance:none;-webkit-appearance:none;width:12px;height:12px;margin:0;border:1px solid var(--bs-strong);border-radius:2px;background:transparent;cursor:pointer;flex-shrink:0}',
    '.bs-skip input:checked{background:var(--bs-accent);border-color:var(--bs-accent)}',
    '.bs-doors{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:stretch}',
    '.bs-card{background:var(--bs-surface);border:1px solid var(--bs-border);padding:24px;display:flex;flex-direction:column;gap:20px;transition:border-color .2s ease}',
    '.bs-card:hover{border-color:var(--bs-strong)}',
    '.bs-card-head{display:flex;flex-direction:column;gap:6px}',
    '.bs-card-title{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:22px;color:var(--bs-text)}',
    '.bs-card-sub{font-size:13.6px;line-height:1.6;color:var(--bs-muted)}',
    '.bs-card-foot{margin-top:auto;display:flex;align-items:center;gap:12px}',
    '.bs-link{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:12.8px;color:var(--bs-accent);transition:.2s ease}.bs-link:hover{color:var(--bs-text)}',
    '.bs-tpls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}',
    '.bs-tpl{display:flex;flex-direction:column;gap:8px;align-items:stretch;width:100%}',
    '.bs-tpl-thumb{width:100%;aspect-ratio:4/3;background:var(--bs-raised);border:1px solid var(--bs-border);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--bs-faint);overflow:hidden;transition:.2s ease}',
    '.bs-tpl-thumb svg{width:48px;height:48px;display:block}.bs-tpl-thumb img{width:100%;height:100%;object-fit:contain;display:block;padding:6px}',
    '.bs-tpl:hover .bs-tpl-thumb{border-color:var(--bs-accent);color:var(--bs-accent)}',
    '.bs-tpl .bs-disp{font-size:14px;color:var(--bs-text)}.bs-tpl .bs-mono{font-size:10px;color:var(--bs-faint);letter-spacing:.04em}',
    '.bs-sizes{display:flex;flex-wrap:wrap;gap:8px}',
    '.bs-size{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10.4px;letter-spacing:.08em;color:var(--bs-muted);border:1px solid var(--bs-strong);border-radius:4px;padding:9px 12px;transition:.2s ease}',
    '.bs-size:hover,.bs-size.on{border-color:var(--bs-accent);color:var(--bs-accent)}',
    '.bs-primary{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:12.8px;letter-spacing:.04em;color:var(--bs-bg);background:var(--bs-accent);border-radius:4px;padding:12px 18px;transition:.2s ease}',
    '.bs-primary:hover{opacity:.85}',
    '.bs-drop{flex:1;min-height:180px;border:1px dashed var(--bs-strong);border-radius:4px;background:var(--bs-soft);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;width:100%;transition:.2s ease}',
    '.bs-drop:hover,.bench-splash.bs-dragging .bs-drop{border-color:var(--bs-accent);background:var(--bs-glow)}',
    '.bs-drop svg{width:28px;height:28px;color:var(--bs-accent)}',
    '.bs-drop .bs-disp{font-size:16px;color:var(--bs-text)}.bs-drop .bs-mono{font-size:10px;letter-spacing:.06em;color:var(--bs-faint);line-height:1.7}',
    '.bs-foot{display:flex;justify-content:space-between;align-items:center;padding:0 48px;height:44px;border-top:1px solid var(--bs-border);font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10px;letter-spacing:.06em;color:var(--bs-faint);flex-shrink:0}',
    '@media (max-width:1100px){.bs-body{grid-template-columns:1fr;gap:40px;padding:40px 32px}.bs-bar,.bs-foot{padding:0 32px}.bs-skip{padding-top:24px}}',
    '@media (max-width:760px){.bs-doors{grid-template-columns:1fr;gap:12px}.bs-name{font-size:40px;margin-top:12px}.bs-tag{max-width:none}.bs-body{padding:24px 16px 32px;gap:28px}.bs-bar{padding:0 16px;height:52px}.bs-bar-right button{padding:9px 12px;font-size:10px}.bs-recent{margin-top:28px}.bs-skip{padding-top:20px;margin-top:0;font-size:11px}.bs-skip input{width:16px;height:16px}.bs-card{padding:20px 16px;gap:16px}.bs-card-title{font-size:20px}.bs-tpls{gap:12px}.bs-size{padding:11px 13px;font-size:11px}.bs-primary{width:100%;text-align:center;padding:14px 18px}.bs-drop{min-height:120px;padding:20px 16px;flex:0 0 auto}.bs-drop .bs-mono{font-size:9.5px;letter-spacing:.03em;word-break:break-word}.bs-foot{padding:12px 16px calc(12px + env(safe-area-inset-bottom));height:auto;flex-direction:column;gap:6px;align-items:flex-start}}',
    '@media (prefers-reduced-motion:reduce){.bench-splash *{transition:none!important}}',
'.bench-help{position:fixed;inset:0;z-index:99991;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:14px;line-height:1.5;color:var(--bs-text);-webkit-font-smoothing:antialiased}',
    '.bench-help *,.bench-help *::before,.bench-help *::after{box-sizing:border-box}',
    '.bench-help a{color:var(--bs-accent);text-decoration:none}.bench-help a:hover{opacity:.75}',
    '.bench-help button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}',
    '.bench-help .bs-label{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10.4px;letter-spacing:.2em;text-transform:uppercase;color:var(--bs-accent)}',
    '.bench-help .bs-brand{display:flex;align-items:center;gap:12px;font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:12px;letter-spacing:.08em}',
    '.bench-help .bs-brand img{width:22px;height:22px;display:block}.bench-help .bs-brand span{color:var(--bs-muted)}',
    '.bench-help .bs-bar-right button{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:9.6px;letter-spacing:.1em;text-transform:uppercase;color:var(--bs-muted);border:1px solid var(--bs-strong);border-radius:4px;padding:5.6px 11.2px;transition:.2s ease}',
    '.bench-help .bs-bar-right button:hover{border-color:var(--bs-accent);color:var(--bs-accent)}',
    '.bench-help .bs-link{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:12.8px;color:var(--bs-accent);transition:.2s ease}.bench-help .bs-link:hover{color:var(--bs-text)}',
    '.bh-panel{width:min(760px,100%);max-height:calc(100vh - 48px);background:var(--bs-bg);border:1px solid var(--bs-strong);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.45)}',
    '.bh-bar{display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px;border-bottom:1px solid var(--bs-border);flex-shrink:0}',
    '.bh-nav{display:flex;gap:4px;padding:12px 24px 0;border-bottom:1px solid var(--bs-border);flex-shrink:0}',
    '.bh-nav button{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10.4px;letter-spacing:.14em;text-transform:uppercase;color:var(--bs-muted);padding:10px 12px 12px;border-bottom:2px solid transparent;margin-bottom:-1px;transition:.2s ease}',
    '.bh-nav button:hover{color:var(--bs-text)}.bh-nav button.on{color:var(--bs-accent);border-bottom-color:var(--bs-accent)}',
    '.bh-body{overflow:auto;padding:24px;display:flex;flex-direction:column;gap:32px;position:relative}',
    '.bh-section{display:flex;flex-direction:column;gap:16px}',
    '.bh-section-title{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:22px;color:var(--bs-text)}',
    '.bh-scope{display:flex;flex-direction:column;gap:6px}',
    '.bh-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 32px}',
    '.bh-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid var(--bs-border)}',
    '.bh-row>span{color:var(--bs-muted);font-size:13.6px}',
    '.bh-keys{display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;align-items:center}',
    '.bh-keys>span{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10px;color:var(--bs-faint)}',
    '.bh-key{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10.4px;letter-spacing:.06em;color:var(--bs-text)!important;border:1px solid var(--bs-strong);border-radius:4px;padding:3px 7px;background:var(--bs-surface);white-space:nowrap}',
    '.bh-tips{display:flex;flex-direction:column}',
    '.bh-tip{display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--bs-border);color:var(--bs-muted);font-size:13.6px;line-height:1.6}',
    '.bh-tip .bs-mono{font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10px;letter-spacing:.06em;color:var(--bs-faint);padding-top:5px;flex-shrink:0;min-width:18px}',
    '.bh-about{display:grid;grid-template-columns:72px minmax(0,1fr);gap:24px;align-items:start}',
    '.bh-about img{width:72px;height:72px;display:block}',
    '.bh-about-col{display:flex;flex-direction:column;gap:10px}',
    '.bh-about-name{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:34px;line-height:1.05;color:var(--bs-text)}',
    '.bh-about p{margin:0;color:var(--bs-muted);font-size:14px;line-height:1.6;max-width:520px;text-wrap:pretty}',
    '.bh-about-links{display:flex;gap:16px;flex-wrap:wrap;margin-top:6px}',
    '.bh-foot{display:flex;justify-content:space-between;align-items:center;padding:0 24px;height:44px;border-top:1px solid var(--bs-border);font-family:"SF Mono",Monaco,"Cascadia Code","Roboto Mono",monospace;font-size:10px;letter-spacing:.06em;color:var(--bs-faint);flex-shrink:0}',
    '@media (max-width:640px){.bh-rows{grid-template-columns:1fr}.bh-about{grid-template-columns:1fr}.bench-help{padding:0}.bh-panel{max-height:100vh;border:0;border-radius:0}}'
  ].join('');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    // Scope every component rule under the root so the button/link resets
    // above never outrank them, whatever the host page's own CSS does.
    s.textContent = css.replace(/(^|[{},])(\s*)\.bs-/g, '$1$2.bench-splash .bs-').replace(/(^|[{},])(\s*)\.bh-/g, '$1$2.bench-help .bh-');
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function storageKey(key) { return 'bench-splash-skip:' + key; }
  function isSkipped(key) {
    try { return localStorage.getItem(storageKey(key)) === '1'; } catch (e) { return false; }
  }
  function setSkipped(key, on) {
    try { on ? localStorage.setItem(storageKey(key), '1') : localStorage.removeItem(storageKey(key)); } catch (e) {}
  }

  function pickVibe(cfg) {
    var v = cfg.vibe || 'darkroom';
    if (cfg.followSiteVibe !== false) {
      try {
        var site = localStorage.getItem('todd-vibe');
        if (site && VIBES[site]) v = site;
      } catch (e) {}
    }
    return VIBES[v] ? v : 'darkroom';
  }

  function applyVibe(root, name) {
    var t = VIBES[name];
    root.setAttribute('data-vibe', name);
    for (var k in t) root.style.setProperty('--bs-' + k, t[k]);
  }

  var UPLOAD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>';

  /* Stroke-only placeholder thumbs. Apps pass their own `thumb` when they have
     something better; these keep the card honest when they don't. */
  var THUMBS = {
    landscape: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="6" y="10" width="36" height="28" rx="1.5"/></svg>',
    portrait:  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="12" y="4" width="24" height="40" rx="1.5"/></svg>',
    grid:      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="6" y="6" width="14" height="14" rx="1.5"/><rect x="28" y="6" width="14" height="14" rx="1.5"/><rect x="6" y="28" width="14" height="14" rx="1.5"/><rect x="28" y="28" width="14" height="14" rx="1.5"/></svg>',
    circle:    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><circle cx="24" cy="24" r="14"/><path d="M24 10v28M10 24h28"/></svg>',
    doc:       '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="10" y="4" width="28" height="40" rx="1.5"/><path d="M16 14h16M16 22h16M16 30h10"/></svg>',
    panels:    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="6" y="4" width="36" height="40" rx="1.5"/><path d="M6 18h36M6 31h36M24 18v13M18 31v13"/></svg>',
    film:      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="4" y="12" width="40" height="24" rx="1.5"/><path d="M4 18h40M4 30h40M12 12v6M20 12v6M28 12v6M36 12v6M12 30v6M20 30v6M28 30v6M36 30v6"/></svg>',
    text:      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M10 12h28M24 12v26M17 38h14"/></svg>',
    lower:     '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="4" y="10" width="40" height="28" rx="1.5"/><rect x="8" y="26" width="22" height="8" rx="1"/></svg>',
    loop:      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M34 14a14 14 0 1 0 4 10"/><path d="M38 6v8h-8"/></svg>',
    person:    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><circle cx="24" cy="14" r="6"/><path d="M12 42v-6a8 8 0 0 1 8-8h8a8 8 0 0 1 8 8v6"/></svg>',
    sticker:   '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><circle cx="14" cy="14" r="7"/><circle cx="34" cy="14" r="7"/><circle cx="14" cy="34" r="7"/><circle cx="34" cy="34" r="7"/></svg>',
    card:      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="4" y="14" width="40" height="22" rx="2"/><path d="M10 22h14M10 28h8"/></svg>',
    poster:    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="10" y="4" width="28" height="40" rx="1.5"/><path d="M16 32h16M16 37h10"/><circle cx="24" cy="18" r="6"/></svg>',
    phone:     '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="14" y="4" width="20" height="40" rx="3"/><path d="M21 38h6"/></svg>',
    deck:      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="8" y="12" width="32" height="20" rx="1.5"/><path d="M4 16v20a2 2 0 0 0 2 2h30M14 20h14M14 25h8"/></svg>',
    dog:       '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 20c-4 0-8 2-8 6s3 5 6 5M34 20c4 0 8 2 8 6s-3 5-6 5"/><path d="M14 20a10 10 0 0 1 20 0v10a10 10 0 0 1-20 0z"/><circle cx="20" cy="24" r="1"/><circle cx="28" cy="24" r="1"/><path d="M22 30h4l-2 2z"/></svg>'
  };

  function thumbNode(thumb) {
    var box = el('div', 'bs-tpl-thumb');
    if (!thumb) thumb = 'landscape';
    if (THUMBS[thumb]) box.innerHTML = THUMBS[thumb];
    else if (/^\s*<svg/i.test(thumb)) box.innerHTML = thumb;
    else { var img = el('img'); img.src = thumb; img.alt = ''; box.appendChild(img); }
    return box;
  }

  // Lift the boot veil (see the inline snippet in each app's <head>).
  function lift() {
    var h = document.documentElement;
    if (h.classList.contains('bench-veil')) {
      // One frame so the start screen paints before the editor becomes visible.
      requestAnimationFrame(function () { h.classList.remove('bench-veil'); });
    }
  }

  function open(cfg) {
    cfg = cfg || {};
    if (!cfg.key) throw new Error('BenchSplash.open: config.key is required');
    if (!cfg.force && isSkipped(cfg.key)) { lift(); return null; }
    injectStyle();

    var root = el('div', 'bench-splash');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', (cfg.eyebrow || "Mr. Todd's") + ' ' + (cfg.name || ''));
    applyVibe(root, pickVibe(cfg));

    var homeUrl = cfg.homeUrl || 'https://toddboswell.com';
    var closed = false;
    function close(reason) {
      if (closed) return; closed = true;
      var box = root.querySelector('.bs-skip input');
      if (box) setSkipped(cfg.key, !!box.checked);
      document.removeEventListener('keydown', onKey, true);
      if (root.parentNode) root.parentNode.removeChild(root);
      if (typeof cfg.onClose === 'function') cfg.onClose(reason || 'skip');
    }
    function run(fn, reason) {
      return function (ev) {
        if (ev) ev.preventDefault();
        close(reason);
        if (typeof fn === 'function') fn();
      };
    }

    /* bar */
    var bar = el('div', 'bs-bar');
    var brand = el('div', 'bs-brand');
    var mark = el('img'); mark.src = KEWPIE; mark.alt = '';
    brand.appendChild(mark);
    var brandText = el('div', null, (cfg.eyebrow || "Mr. Todd's") + ' ');
    brandText.appendChild(el('span', null, cfg.name || ''));
    brand.appendChild(brandText);
    bar.appendChild(brand);
    var right = el('div', 'bs-bar-right');
    var home = el('a', null, homeUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    home.href = homeUrl; home.target = '_blank'; home.rel = 'noopener';
    right.appendChild(home);
    var skipBtn = el('button', null, 'Just open it');
    skipBtn.type = 'button';
    skipBtn.addEventListener('click', run(null, 'skip'));
    right.appendChild(skipBtn);
    bar.appendChild(right);
    root.appendChild(bar);

    /* body */
    var body = el('div', 'bs-body');

    var intro = el('div', 'bs-intro');
    intro.appendChild(el('div', 'bs-label', cfg.kicker || 'Open a file, or start one'));
    intro.appendChild(el('div', 'bs-name', cfg.name || ''));
    if (cfg.tagline) intro.appendChild(el('div', 'bs-tag', cfg.tagline));

    var recentWrap = el('div', 'bs-recent');
    recentWrap.style.display = 'none';
    var recentLabel = el('div', 'bs-label faint', 'Recent');
    var recentList = el('div', 'bs-recent-list');
    recentWrap.appendChild(recentLabel);
    recentWrap.appendChild(recentList);
    intro.appendChild(recentWrap);
    function fillRecent(items) {
      if (!items || !items.length) return;
      recentList.innerHTML = '';
      items.slice(0, 4).forEach(function (r) {
        var b = el('button'); b.type = 'button';
        b.appendChild(el('div', 'bs-disp', r.name || 'Untitled'));
        if (r.meta) b.appendChild(el('div', 'bs-mono', r.meta));
        b.addEventListener('click', run(r.run, 'recent'));
        recentList.appendChild(b);
      });
      recentWrap.style.display = '';
    }
    if (cfg.recent && typeof cfg.recent.then === 'function') cfg.recent.then(fillRecent, function () {});
    else fillRecent(cfg.recent);

    var skip = el('label', 'bs-skip');
    var box = el('input'); box.type = 'checkbox'; box.checked = false;
    skip.appendChild(box);
    skip.appendChild(el('span', null, 'Skip this screen next time'));
    intro.appendChild(skip);
    body.appendChild(intro);

    var doors = el('div', 'bs-doors');

    /* 01 template */
    if (cfg.templates && cfg.templates.length) {
      var c1 = el('div', 'bs-card');
      var h1 = el('div', 'bs-card-head');
      h1.appendChild(el('div', 'bs-label', '01 · Template'));
      h1.appendChild(el('div', 'bs-card-title', 'Start from a template'));
      h1.appendChild(el('div', 'bs-card-sub', cfg.templateSub || 'A head start you can throw away.'));
      c1.appendChild(h1);
      var grid = el('div', 'bs-tpls');
      cfg.templates.slice(0, 4).forEach(function (t) {
        var b = el('button', 'bs-tpl'); b.type = 'button';
        b.appendChild(thumbNode(t.thumb));
        b.appendChild(el('div', 'bs-disp', t.name));
        if (t.meta) b.appendChild(el('div', 'bs-mono', t.meta));
        b.addEventListener('click', run(t.run, 'template'));
        grid.appendChild(b);
      });
      c1.appendChild(grid);
      var f1 = el('div', 'bs-card-foot');
      if (typeof cfg.moreTemplates === 'function') {
        var more = el('button', 'bs-link', 'All templates →'); more.type = 'button';
        more.addEventListener('click', run(cfg.moreTemplates, 'template'));
        f1.appendChild(more);
      }
      c1.appendChild(f1);
      doors.appendChild(c1);
    }

    /* 02 blank */
    var c2 = el('div', 'bs-card');
    var h2 = el('div', 'bs-card-head');
    h2.appendChild(el('div', 'bs-label', '02 · Blank'));
    h2.appendChild(el('div', 'bs-card-title', 'Start from scratch'));
    h2.appendChild(el('div', 'bs-card-sub', cfg.blankSub || 'Pick a size. Change it later if you want.'));
    c2.appendChild(h2);
    var chosen = null;
    if (cfg.sizes && cfg.sizes.length) {
      var sizes = el('div', 'bs-sizes');
      cfg.sizes.forEach(function (s, i) {
        var b = el('button', 'bs-size' + (i === 0 ? ' on' : ''), s.label); b.type = 'button';
        if (i === 0) chosen = s;
        b.addEventListener('click', function (ev) {
          ev.preventDefault();
          if (s.immediate) { run(s.run, 'blank')(); return; }
          chosen = s;
          Array.prototype.forEach.call(sizes.children, function (x) { x.classList.remove('on'); });
          b.classList.add('on');
        });
        sizes.appendChild(b);
      });
      c2.appendChild(sizes);
    }
    var f2 = el('div', 'bs-card-foot');
    var primary = el('button', 'bs-primary', (cfg.primary && cfg.primary.label) || ('New ' + (cfg.name || 'document').toLowerCase()));
    primary.type = 'button';
    primary.addEventListener('click', function (ev) {
      ev.preventDefault();
      var fn = chosen && chosen.run ? chosen.run : (cfg.primary && cfg.primary.run);
      run(fn, 'blank')();
    });
    f2.appendChild(primary);
    c2.appendChild(f2);
    doors.appendChild(c2);

    /* 03 open */
    if (cfg.open) {
      var c3 = el('div', 'bs-card');
      var h3 = el('div', 'bs-card-head');
      h3.appendChild(el('div', 'bs-label', '03 · Open'));
      h3.appendChild(el('div', 'bs-card-title', 'Open or import'));
      h3.appendChild(el('div', 'bs-card-sub', cfg.openSub || "Yours, or someone else's."));
      c3.appendChild(h3);
      var drop = el('button', 'bs-drop'); drop.type = 'button';
      drop.innerHTML = UPLOAD_SVG;
      drop.appendChild(el('div', 'bs-disp', cfg.open.hint || 'Drop a file here'));
      if (cfg.open.formats) drop.appendChild(el('div', 'bs-mono', cfg.open.formats));
      drop.addEventListener('click', run(cfg.open.browse, 'open'));
      c3.appendChild(drop);
      var f3 = el('div', 'bs-card-foot');
      var browse = el('button', 'bs-link', 'Browse… →'); browse.type = 'button';
      browse.addEventListener('click', run(cfg.open.browse, 'open'));
      f3.appendChild(browse);
      c3.appendChild(f3);
      doors.appendChild(c3);

      if (typeof cfg.open.files === 'function') {
        var depth = 0;
        root.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; root.classList.add('bs-dragging'); });
        root.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
        root.addEventListener('dragleave', function (e) { e.preventDefault(); if (--depth <= 0) { depth = 0; root.classList.remove('bs-dragging'); } });
        root.addEventListener('drop', function (e) {
          e.preventDefault(); e.stopPropagation();
          root.classList.remove('bs-dragging');
          var files = e.dataTransfer && e.dataTransfer.files;
          if (files && files.length) { close('open'); cfg.open.files(files); }
        });
      }
    }

    body.appendChild(doors);
    root.appendChild(body);

    /* foot */
    var foot = el('div', 'bs-foot');
    foot.appendChild(el('div', null, cfg.footer || 'Nothing leaves the browser.'));
    var credit = el('div', null, 'Part of the bench at ');
    var link = el('a', null, homeUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    link.href = homeUrl; link.target = '_blank'; link.rel = 'noopener';
    credit.appendChild(link);
    foot.appendChild(credit);
    root.appendChild(foot);

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close('escape'); }
    }
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(root);
    lift();
    var first = root.querySelector('.bs-primary');
    if (first) try { first.focus({ preventScroll: true }); } catch (e) {}

    return { close: close, el: root };
  }

  /* ---------- Help panel ----------
     Shortcuts, tips and an About block in the same vibe as the start screen.
     Apps call BenchSplash.help({...}) from a Help menu; `section` picks
     where it opens. */
  function keysNode(keys) {
    var wrap = el('div', 'bh-keys');
    String(keys).split(/\s+or\s+/).forEach(function (combo, i) {
      if (i) wrap.appendChild(el('span', null, 'or'));
      // A literal plus key ("+", "Ctrl++") must survive the split on "+".
      combo.replace(/\+\+/g, '+\u0000').replace(/^\s*\+\s*$/, '\u0000').split('+').forEach(function (k) {
        k = k.trim().replace(/\u0000/g, '+');
        if (k) wrap.appendChild(el('span', 'bh-key', k));
      });
    });
    return wrap;
  }

  function help(cfg) {
    cfg = cfg || {};
    injectStyle();
    var root = el('div', 'bench-help');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', (cfg.name || '') + ' help');
    applyVibe(root, pickVibe(cfg));
    var homeUrl = cfg.homeUrl || 'https://toddboswell.com';
    var name = cfg.name || '';
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey, true);
      if (root.parentNode) root.parentNode.removeChild(root);
      if (typeof cfg.onClose === 'function') cfg.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }

    var panel = el('div', 'bh-panel');
    var bar = el('div', 'bh-bar');
    var brand = el('div', 'bs-brand');
    var mark = el('img'); mark.src = KEWPIE; mark.alt = '';
    brand.appendChild(mark);
    var bt = el('div', null, (cfg.eyebrow || "Mr. Todd's") + ' ');
    bt.appendChild(el('span', null, name + ' · Help'));
    brand.appendChild(bt);
    bar.appendChild(brand);
    var right = el('div', 'bs-bar-right');
    var x = el('button', null, 'Close'); x.type = 'button'; x.addEventListener('click', close);
    right.appendChild(x);
    bar.appendChild(right);
    panel.appendChild(bar);

    var sections = [];
    var body = el('div', 'bh-body');

    if (cfg.shortcuts && cfg.shortcuts.length) {
      var sec = el('div', 'bh-section');
      sec.appendChild(el('div', 'bh-section-title', 'Keyboard shortcuts'));
      var scopes = [];
      cfg.shortcuts.forEach(function (sc) { var g = sc.scope || 'General'; if (scopes.indexOf(g) < 0) scopes.push(g); });
      scopes.forEach(function (g) {
        var box = el('div', 'bh-scope');
        box.appendChild(el('div', 'bs-label', g));
        var rows = el('div', 'bh-rows');
        cfg.shortcuts.filter(function (sc) { return (sc.scope || 'General') === g; }).forEach(function (sc) {
          var r = el('div', 'bh-row');
          r.appendChild(el('span', null, sc.label));
          r.appendChild(keysNode(sc.keys));
          rows.appendChild(r);
        });
        box.appendChild(rows);
        sec.appendChild(box);
      });
      body.appendChild(sec); sections.push(['shortcuts', 'Shortcuts', sec]);
    }

    if (cfg.tips && cfg.tips.length) {
      var tsec = el('div', 'bh-section');
      tsec.appendChild(el('div', 'bh-section-title', 'Tips'));
      var list = el('div', 'bh-tips');
      cfg.tips.forEach(function (t, i) {
        var row = el('div', 'bh-tip');
        row.appendChild(el('span', 'bs-mono', (i < 9 ? '0' : '') + (i + 1)));
        row.appendChild(el('span', null, t));
        list.appendChild(row);
      });
      tsec.appendChild(list);
      body.appendChild(tsec); sections.push(['tips', 'Tips', tsec]);
    }

    var asec = el('div', 'bh-section');
    asec.appendChild(el('div', 'bh-section-title', 'About'));
    var about = el('div', 'bh-about');
    var big = el('img'); big.src = KEWPIE; big.alt = '';
    about.appendChild(big);
    var col = el('div', 'bh-about-col');
    col.appendChild(el('div', 'bs-label', cfg.eyebrow || "Mr. Todd's"));
    col.appendChild(el('div', 'bh-about-name', name));
    if (cfg.tagline) col.appendChild(el('p', null, cfg.tagline));
    (cfg.about || []).forEach(function (line) { col.appendChild(el('p', null, line)); });
    col.appendChild(el('p', null, 'Made by Todd Boswell in Omaha. Runs in the browser; nothing you make here leaves it.'));
    if (cfg.license !== false) {
      col.appendChild(el('p', null, cfg.license || 'Free software: GNU Affero General Public License v3. Copyright \u00a9 2026 Todd Boswell. Copy it, change it, share it, and keep the name on it.'));
    }
    var links = el('div', 'bh-about-links');
    var home = el('a', 'bs-link', homeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') + ' →');
    home.href = homeUrl; home.target = '_blank'; home.rel = 'noopener';
    links.appendChild(home);
    if (typeof cfg.onStartScreen === 'function') {
      var st = el('button', 'bs-link', 'Start screen →'); st.type = 'button';
      st.addEventListener('click', function () { close(); cfg.onStartScreen(); });
      links.appendChild(st);
    }
    (cfg.links || []).forEach(function (l) {
      var a = el('a', 'bs-link', l.label + ' →'); a.href = l.href; a.target = '_blank'; a.rel = 'noopener';
      links.appendChild(a);
    });
    col.appendChild(links);
    about.appendChild(col);
    asec.appendChild(about);
    body.appendChild(asec); sections.push(['about', 'About', asec]);

    var nav = el('div', 'bh-nav');
    sections.forEach(function (sd) {
      var b = el('button', null, sd[1]); b.type = 'button'; b.setAttribute('data-section', sd[0]);
      b.addEventListener('click', function () { body.scrollTo({ top: sd[2].offsetTop - 24, behavior: 'smooth' }); });
      nav.appendChild(b);
    });
    panel.appendChild(nav);
    panel.appendChild(body);

    var foot = el('div', 'bh-foot');
    foot.appendChild(el('div', null, 'Esc closes'));
    foot.appendChild(el('div', null, cfg.version ? name + ' · ' + cfg.version : 'Part of the bench at toddboswell.com'));
    panel.appendChild(foot);
    root.appendChild(panel);

    root.addEventListener('click', function (e) { if (e.target === root) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(root);

    function syncNav() {
      var top = body.scrollTop + 8, cur = sections[0];
      sections.forEach(function (sd) { if (sd[2].offsetTop - 24 <= top) cur = sd; });
      Array.prototype.forEach.call(nav.children, function (b) { b.classList.toggle('on', b.getAttribute('data-section') === cur[0]); });
    }
    body.addEventListener('scroll', syncNav);
    var want = sections.filter(function (sd) { return sd[0] === cfg.section; })[0];
    if (want) body.scrollTop = want[2].offsetTop - 24;
    syncNav();
    try { x.focus({ preventScroll: true }); } catch (e) {}
    return { close: close, el: root };
  }


  function markImg(size) {
    var img = document.createElement('img');
    img.src = KEWPIE; img.alt = ''; img.width = size || 22; img.height = size || 22;
    img.style.display = 'block';
    return img;
  }

  global.BenchSplash = { open: open, help: help, lift: lift, isSkipped: isSkipped, setSkipped: setSkipped, kewpie: KEWPIE, mark: markImg, vibes: VIBES, thumbs: THUMBS };
})(typeof window !== 'undefined' ? window : this);
