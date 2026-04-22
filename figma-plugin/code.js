// Select States Generator – G1 & G2, single & multiple
// Font: Inter 14px  |  Tokens from FineDesign CSS variables

figma.showUI(__html__, { width: 300, height: 200, title: 'Select States Generator' });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate') {
    try {
      await generate();
      figma.ui.postMessage({ type: 'done' });
    } catch (e) {
      figma.ui.postMessage({ type: 'error', message: e.message });
    }
  }
  if (msg.type === 'cancel') figma.closePlugin();
};

async function loadFonts() {
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
  ]);
}

// ── FD Design Tokens ─────────────────────────────────────────────────────────
// --fd-control-height: 32px
// --fd-padding: 8px
// --fd-gap: 8px
// --fd-icon-size: 16px
// --fd-border-radius: 6px
// --fd-border-radius-sm: 3px
// --fd-font-size: 14px

const FD = {
  controlH:   32,
  padding:     8,
  gap:         8,
  iconSize:   16,
  radius:      6,
  radiusSm:    3,
  fontSize:   14,
  fontSizeSm: 12,
};

const C = {
  text:          { r: 0.122, g: 0.161, b: 0.216 }, // #1F2937 --fd-color-text
  textSecondary: { r: 0.541, g: 0.580, b: 0.671 }, // #8A94AB --fd-color-text-secondary
  textQuaternary:{ r: 0.749, g: 0.784, b: 0.851 }, // #BFC8D9 --fd-color-text-quaternary
  primary:       { r: 0,     g: 0.569, b: 0.710 }, // #0091B5 --fd-color-primary
  warning:       { r: 0.941, g: 0.659, b: 0     }, // #F0A800 --fd-color-warning-text
  warningBg:     { r: 1,     g: 0.973, b: 0.898 }, // #FFF8E5
  warningBorder: { r: 1,     g: 0.835, b: 0.569 }, // #FFD591
  border:        { r: 0.878, g: 0.894, b: 0.937 }, // #E0E4EF --fd-border-color
  hover:         { r: 0.961, g: 0.969, b: 0.980 }, // #F5F7FA --fd-color-fill-hover
  fillSecondary: { r: 0.961, g: 0.961, b: 0.961 }, // #F5F5F5 chip bg
  white:         { r: 1,     g: 1,     b: 1     },
  cardBg:        { r: 0.976, g: 0.980, b: 0.988 }, // #F9FAFB
};

// ── Low-level helpers ─────────────────────────────────────────────────────────

function s(c) { return { type: 'SOLID', color: c }; }
function sa(c, a) { return { type: 'SOLID', color: c, opacity: a }; }

function txt(str, color, size, medium) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: medium ? 'Medium' : 'Regular' };
  t.fontSize = size || FD.fontSize;
  t.characters = str;
  t.fills = [s(color || C.text)];
  return t;
}

// Auto-layout frame helper
// dir: 'H' | 'V'
// sizing: 'hug' | 'fixed'
// align: main axis align 'MIN'|'CENTER'|'MAX'|'SPACE_BETWEEN'
// cross: counter axis align 'MIN'|'CENTER'|'MAX'
function al(dir, gap, pTop, pRight, pBottom, pLeft, sizing, align, cross) {
  const f = figma.createFrame();
  f.layoutMode = dir === 'H' ? 'HORIZONTAL' : 'VERTICAL';
  f.itemSpacing = gap || 0;
  f.paddingTop = pTop || 0;
  f.paddingRight = pRight || 0;
  f.paddingBottom = pBottom || 0;
  f.paddingLeft = pLeft || 0;
  f.primaryAxisSizingMode = (sizing === 'fixed') ? 'FIXED' : 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.primaryAxisAlignItems = align || 'MIN';
  f.counterAxisAlignItems = cross || 'MIN';
  f.fills = [];
  f.clipsContent = false;
  return f;
}

// ── Atomic components ─────────────────────────────────────────────────────────

// Chip tag in trigger  (selected value)
function chipTag(label) {
  const f = al('H', 3, 2, 6, 2, 6, 'hug', 'CENTER', 'CENTER');
  f.fills = [s(C.fillSecondary)];
  f.strokes = [s(C.border)];
  f.strokeWeight = 1;
  f.strokeAlign = 'INSIDE';
  f.cornerRadius = FD.radiusSm;
  f.appendChild(txt(label, C.text, FD.fontSizeSm));
  f.appendChild(txt('×', C.textSecondary, 11));
  return f;
}

// "全部" primary tag
function allTagNode() {
  const f = al('H', 0, 2, 8, 2, 8, 'hug', 'CENTER', 'CENTER');
  f.fills = [s(C.primary)];
  f.cornerRadius = FD.radiusSm;
  f.appendChild(txt('全部', C.white, FD.fontSizeSm, true));
  return f;
}

// Chevron vector
function chevronVec(up) {
  const v = figma.createVector();
  v.resize(10, 6);
  v.fills = [];
  v.strokes = [s(C.textSecondary)];
  v.strokeWeight = 1.5;
  v.strokeCap = 'ROUND';
  v.strokeJoin = 'ROUND';
  v.vectorPaths = [{ windingRule: 'NONE', data: up ? 'M 0 6 L 5 1 L 10 6' : 'M 0 0 L 5 5 L 10 0' }];
  return v;
}

// Magnifier vector
function magnifierVec() {
  const v = figma.createVector();
  v.resize(FD.iconSize, FD.iconSize);
  v.fills = [];
  v.strokes = [s(C.textSecondary)];
  v.strokeWeight = 1.5;
  v.strokeCap = 'ROUND';
  v.strokeJoin = 'ROUND';
  v.vectorPaths = [{ windingRule: 'NONE', data: 'M 7 13 C 10.31 13 13 10.31 13 7 C 13 3.69 10.31 1 7 1 C 3.69 1 1 3.69 1 7 C 1 10.31 3.69 13 7 13 Z M 15 15 L 11.5 11.5' }];
  return v;
}

// Checkbox
function cbNode(checked) {
  const f = figma.createFrame();
  f.resize(FD.iconSize, FD.iconSize);
  f.cornerRadius = 3;
  f.clipsContent = false;
  if (checked) {
    f.fills = [s(C.primary)];
    f.strokes = [];
    const ck = figma.createVector();
    ck.resize(10, 8);
    ck.fills = [];
    ck.strokes = [s(C.white)];
    ck.strokeWeight = 1.5;
    ck.strokeCap = 'ROUND';
    ck.strokeJoin = 'ROUND';
    ck.vectorPaths = [{ windingRule: 'NONE', data: 'M 1 4 L 3.5 6.5 L 9 1' }];
    ck.x = 3; ck.y = 4;
    f.appendChild(ck);
  } else {
    f.fills = [s(C.white)];
    f.strokes = [s(C.border)];
    f.strokeWeight = 1;
    f.strokeAlign = 'INSIDE';
  }
  return f;
}

// Divider
function divNode(w) {
  const r = figma.createRectangle();
  r.resize(w, 1);
  r.fills = [s(C.border)];
  return r;
}

// ── Composed components ───────────────────────────────────────────────────────

// Select trigger (multiple, tags)
// opts: { width, placeholder, values[], focused, open, showAll }
function Trigger(opts) {
  const o = opts || {};
  const W = o.width || 320;
  const f = figma.createFrame();
  f.resize(W, FD.controlH);
  f.cornerRadius = FD.radius;
  f.fills = [s(C.white)];
  f.strokes = [s(o.focused ? C.primary : C.border)];
  f.strokeWeight = o.focused ? 2 : 1;
  f.strokeAlign = 'INSIDE';
  f.clipsContent = false;
  if (o.focused) {
    f.effects = [{
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0.569, b: 0.710, a: 0.14 },
      offset: { x: 0, y: 0 },
      radius: 0, spread: 3,
      visible: true, blendMode: 'NORMAL',
    }];
  }

  // inner content row (fills width minus chevron area)
  const inner = al('H', 4, 0, 0, 0, FD.padding, 'hug', 'MIN', 'CENTER');
  inner.counterAxisSizingMode = 'FIXED';
  inner.resize(1, FD.controlH); // will be stretched by parent
  inner.clipsContent = true;
  inner.fills = [];

  const vals = o.values || [];
  if (vals.length === 0) {
    inner.appendChild(txt(o.placeholder || '请选择', C.textSecondary, FD.fontSize));
  } else {
    vals.slice(0, 2).forEach(v => inner.appendChild(chipTag(v)));
    const overflow = vals.length - 2;
    if (overflow > 0) inner.appendChild(chipTag('+' + overflow));
    if (o.showAll) inner.appendChild(allTagNode());
  }

  // place inner and chevron absolutely
  inner.x = 0;
  inner.y = 0;
  inner.resize(W - FD.padding - FD.iconSize - FD.padding, FD.controlH);
  f.appendChild(inner);

  const cv = chevronVec(o.open || false);
  cv.x = W - FD.padding - FD.iconSize / 2 - 5; // center chevron
  cv.y = (FD.controlH - 6) / 2;
  f.appendChild(cv);

  return f;
}

// Single-select trigger
// opts: { width, placeholder, value, focused, open }
function TriggerSingle(opts) {
  const o = opts || {};
  const W = o.width || 320;
  const f = figma.createFrame();
  f.resize(W, FD.controlH);
  f.cornerRadius = FD.radius;
  f.fills = [s(C.white)];
  f.strokes = [s(o.focused ? C.primary : C.border)];
  f.strokeWeight = o.focused ? 2 : 1;
  f.strokeAlign = 'INSIDE';
  f.clipsContent = false;
  if (o.focused) {
    f.effects = [{
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0.569, b: 0.710, a: 0.14 },
      offset: { x: 0, y: 0 },
      radius: 0, spread: 3,
      visible: true, blendMode: 'NORMAL',
    }];
  }

  const label = o.value
    ? txt(o.value, C.text, FD.fontSize)
    : txt(o.placeholder || '请选择', C.textSecondary, FD.fontSize);
  label.x = FD.padding;
  label.y = (FD.controlH - FD.fontSize) / 2;
  f.appendChild(label);

  const cv = chevronVec(o.open || false);
  cv.x = W - FD.padding - FD.iconSize / 2 - 5;
  cv.y = (FD.controlH - 6) / 2;
  f.appendChild(cv);

  return f;
}

// Search bar row (inside dropdown, with bottom border only)
// opts: { width, value, dimmed }
function SearchBar(opts) {
  const o = opts || {};
  const W = o.width || 320;
  const H = 36;
  const f = figma.createFrame();
  f.resize(W, H);
  f.fills = [s(C.white)];
  f.strokes = [s(C.border)];
  f.strokeWeight = 1;
  f.strokeAlign = 'INSIDE';
  f.strokeTopWeight = 0;
  f.strokeBottomWeight = 1;
  f.strokeLeftWeight = 0;
  f.strokeRightWeight = 0;

  const icon = magnifierVec();
  icon.x = FD.padding;
  icon.y = (H - FD.iconSize) / 2;
  f.appendChild(icon);

  // Search text is always dark (#1F2937) — paste-locked state doesn't dim the text
  const label = o.value
    ? txt(o.value, C.text, FD.fontSize)
    : txt('搜索', C.textQuaternary, FD.fontSize);
  label.x = FD.padding + FD.iconSize + FD.gap;
  label.y = (H - FD.fontSize) / 2;
  f.appendChild(label);

  // Text cursor: only in normal (non-paste) state
  if (!o.dimmed && o.value) {
    const cursor = figma.createRectangle();
    cursor.resize(1, 16);
    cursor.fills = [s(C.primary)];
    cursor.x = FD.padding + FD.iconSize + FD.gap + (o.value.length * 8.2);
    cursor.y = (H - 16) / 2;
    f.appendChild(cursor);
  }

  return f;
}

// Custom value row (G1 only)
// Structure from CSS .dd-custom-kw:
//   padding-left: 8+16+8 = 32px  (aligns with option text)
//   inline: "自定义值："(grey) + keyword(orange) + "  |  "(grey) + "回车确认"(grey)
function CustomKwRow(opts) {
  const o = opts || {};
  const W = o.width || 320;
  // indent = --fd-padding(8) + checkbox/icon(16) + --fd-gap(8) = 32
  const INDENT = FD.padding + FD.iconSize + FD.gap;

  // outer fixed frame (full width × controlH)
  const f = figma.createFrame();
  f.resize(W, FD.controlH);
  f.fills = [];

  // inner auto-layout row: hugs content, vertically centered
  const row = figma.createFrame();
  row.layoutMode = 'HORIZONTAL';
  row.itemSpacing = 0;
  row.primaryAxisSizingMode = 'AUTO';
  row.counterAxisSizingMode = 'FIXED';
  row.primaryAxisAlignItems = 'MIN';
  row.counterAxisAlignItems = 'CENTER';
  row.paddingLeft = 0; row.paddingRight = 0;
  row.paddingTop = 0;  row.paddingBottom = 0;
  row.fills = [];
  // Set height before adding children so Figma knows the counter axis
  row.resize(10, FD.controlH);

  row.appendChild(txt('自定义值：', C.textSecondary, FD.fontSize));
  row.appendChild(txt(o.keyword || '', C.warning, FD.fontSize));
  row.appendChild(txt('  |  ', C.textSecondary, FD.fontSize));
  row.appendChild(txt('回车确认', C.textSecondary, FD.fontSize));

  row.x = INDENT;
  row.y = 0;
  f.appendChild(row);

  return f;
}

// Option row
// opts: { width, label, checked, highlighted, multiple, isCheckAll }
function OptionRow(opts) {
  const o = opts || {};
  const W = o.width || 320;
  const f = figma.createFrame();
  f.resize(W, FD.controlH);
  f.fills = o.highlighted ? [s(C.hover)] : [];

  if (o.isCheckAll) {
    const t = txt(o.label || '全选', C.primary, FD.fontSize);
    t.x = FD.padding;
    t.y = (FD.controlH - FD.fontSize) / 2;
    f.appendChild(t);
  } else if (o.multiple) {
    const cb = cbNode(o.checked || false);
    cb.x = FD.padding;
    cb.y = (FD.controlH - FD.iconSize) / 2;
    f.appendChild(cb);

    const textX = FD.padding + FD.iconSize + FD.gap;
    const t = txt(o.label || '', o.checked ? C.primary : C.text, FD.fontSize);
    t.x = textX;
    t.y = (FD.controlH - FD.fontSize) / 2;
    f.appendChild(t);
  } else {
    const t = txt(o.label || '', C.text, FD.fontSize);
    t.x = FD.padding;
    t.y = (FD.controlH - FD.fontSize) / 2;
    f.appendChild(t);
  }
  return f;
}

// Dropdown panel
// opts: { width, multiple, searchValue, dimmedSearch,
//         showCustomKw, customKw,
//         showCheckAll, checkAllLabel,
//         rows: [{ label, checked, highlighted }] }
function Dropdown(opts) {
  const o = opts || {};
  const W = o.width || 320;

  const rows = o.rows || [];
  const hasCheckAll = o.showCheckAll;
  const hasCustomKw = o.showCustomKw && o.customKw;

  let totalH = 36; // search bar
  if (hasCustomKw) totalH += FD.controlH + 1; // row + divider
  if (hasCheckAll) totalH += FD.controlH + 1; // row + divider
  totalH += rows.length * FD.controlH;

  const f = figma.createFrame();
  f.resize(W, totalH);
  f.cornerRadius = FD.radius;
  f.fills = [s(C.white)];
  f.strokes = [s(C.border)];
  f.strokeWeight = 1;
  f.strokeAlign = 'OUTSIDE';
  f.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 0.063, g: 0.094, b: 0.157, a: 0.10 },
    offset: { x: 0, y: 6 },
    radius: 20, spread: 0,
    visible: true, blendMode: 'NORMAL',
  }];

  let y = 0;

  // search
  const sb = SearchBar({ width: W, value: o.searchValue, dimmed: o.dimmedSearch });
  sb.y = y; f.appendChild(sb); y += 36;

  // custom kw row + divider
  if (hasCustomKw) {
    const kr = CustomKwRow({ width: W, keyword: o.customKw });
    kr.y = y; f.appendChild(kr); y += FD.controlH;
    const dl = divNode(W); dl.y = y; f.appendChild(dl); y += 1;
  }

  // check all + divider
  if (hasCheckAll) {
    const car = OptionRow({ width: W, label: o.checkAllLabel || '全选', isCheckAll: true });
    car.y = y; f.appendChild(car); y += FD.controlH;
    const dl = divNode(W); dl.y = y; f.appendChild(dl); y += 1;
  }

  // option rows
  for (const row of rows) {
    const r = OptionRow({ width: W, label: row.label, checked: row.checked, highlighted: row.highlighted, multiple: o.multiple });
    r.y = y; f.appendChild(r); y += FD.controlH;
  }

  return f;
}

// ── State card ────────────────────────────────────────────────────────────────

function StateCard(label, trigNode, ddNode) {
  const PAD = 20;
  const LABEL_H = 28;
  const trigW = trigNode.width;
  const cardW = trigW + PAD * 2;
  const ddH = ddNode ? ddNode.height + 4 : 0;
  const cardH = LABEL_H + trigNode.height + ddH + PAD;

  const f = figma.createFrame();
  f.resize(cardW, cardH);
  f.cornerRadius = 10;
  f.fills = [s(C.cardBg)];
  f.strokes = [s(C.border)];
  f.strokeWeight = 1;
  f.strokeAlign = 'INSIDE';
  f.clipsContent = false;

  const lbl = txt(label, C.textSecondary, 11);
  lbl.x = PAD;
  lbl.y = 10;
  f.appendChild(lbl);

  trigNode.x = PAD;
  trigNode.y = LABEL_H;
  f.appendChild(trigNode);

  if (ddNode) {
    ddNode.x = PAD;
    ddNode.y = LABEL_H + trigNode.height + 4;
    f.appendChild(ddNode);
  }

  return f;
}

// ── Variant definitions ───────────────────────────────────────────────────────

const TW = 280;
const DW = 280;

const BASE_ROWS = [
  { label: '北京' }, { label: '上海' }, { label: '深圳' },
  { label: '广州' }, { label: '成都' },
];

function statesG1Single() {
  return [
    StateCard('1  空状态 · 下拉打开',
      TriggerSingle({ width: TW, placeholder: '请选择城市', focused: true, open: true }),
      Dropdown({ width: DW, searchValue: null, rows: BASE_ROWS })
    ),
    StateCard('2  手动输入搜索',
      TriggerSingle({ width: TW, focused: true, open: true }),
      Dropdown({ width: DW, searchValue: '北', showCustomKw: true, customKw: '北', rows: [{ label: '北京', highlighted: true }] })
    ),
    StateCard('3a  批量粘贴 · 含自定义值',
      TriggerSingle({ width: TW, focused: true, open: true }),
      Dropdown({ width: DW, searchValue: '未知城市,北京', dimmedSearch: true, showCustomKw: true, customKw: '未知城市', rows: [{ label: '北京', highlighted: true }] })
    ),
    StateCard('3b  批量粘贴 · 首项非自定义值',
      TriggerSingle({ width: TW, focused: true, open: true }),
      Dropdown({ width: DW, searchValue: '北京,上海', dimmedSearch: true, rows: [{ label: '北京', highlighted: true }, { label: '上海' }] })
    ),
    StateCard('4  回车回填结果',
      TriggerSingle({ width: TW, value: '未知城市' })
    ),
  ];
}

function statesG1Multiple() {
  return [
    StateCard('1  空状态 · 下拉打开',
      Trigger({ width: TW, placeholder: '请选择城市（多选）', focused: true, open: true }),
      Dropdown({ width: DW, multiple: true, rows: BASE_ROWS })
    ),
    StateCard('2  手动输入搜索',
      Trigger({ width: TW, values: ['北京'], focused: true, open: true }),
      Dropdown({ width: DW, multiple: true, searchValue: '深圳', showCustomKw: true, customKw: '深圳', rows: [{ label: '深圳' }] })
    ),
    StateCard('3a  批量粘贴 · 含自定义值',
      Trigger({ width: TW, values: ['北京'], focused: true, open: true }),
      Dropdown({ width: DW, multiple: true, searchValue: '未知A,北京,未知B', dimmedSearch: true, showCheckAll: true, checkAllLabel: '搜索结果全选', showCustomKw: true, customKw: '未知A  未知B', rows: [{ label: '北京', checked: true }] })
    ),
    StateCard('3b  批量粘贴 · 首项非自定义值',
      Trigger({ width: TW, values: ['北京'], focused: true, open: true }),
      Dropdown({ width: DW, multiple: true, searchValue: '北京,上海,深圳', dimmedSearch: true, showCheckAll: true, checkAllLabel: '搜索结果全选', rows: [{ label: '北京', checked: true }, { label: '上海' }, { label: '深圳' }] })
    ),
    StateCard('4  回车回填结果',
      Trigger({ width: TW, values: ['北京', '未知A', '未知B'] })
    ),
  ];
}

function statesG2Single() {
  return [
    StateCard('1  空状态 · 下拉打开',
      TriggerSingle({ width: TW, placeholder: '请选择（精确匹配）', focused: true, open: true }),
      Dropdown({ width: DW, rows: BASE_ROWS })
    ),
    StateCard('2  手动输入搜索',
      TriggerSingle({ width: TW, focused: true, open: true }),
      Dropdown({ width: DW, searchValue: '北', rows: [{ label: '北京', highlighted: true }] })
    ),
    StateCard('3a  批量粘贴 · 含自定义（忽略）',
      TriggerSingle({ width: TW, focused: true, open: true }),
      Dropdown({ width: DW, searchValue: '未知城市,北京', dimmedSearch: true, rows: [{ label: '北京', highlighted: true }] })
    ),
    StateCard('3b  批量粘贴 · 首项非自定义',
      TriggerSingle({ width: TW, focused: true, open: true }),
      Dropdown({ width: DW, searchValue: '北京,上海', dimmedSearch: true, rows: [{ label: '北京', highlighted: true }, { label: '上海' }] })
    ),
    StateCard('4  回车回填结果',
      TriggerSingle({ width: TW, value: '北京' })
    ),
  ];
}

function statesG2Multiple() {
  return [
    StateCard('1  空状态 · 下拉打开',
      Trigger({ width: TW, placeholder: '请选择（精确·多选）', focused: true, open: true }),
      Dropdown({ width: DW, multiple: true, rows: BASE_ROWS })
    ),
    StateCard('2  手动输入搜索',
      Trigger({ width: TW, values: ['北京'], focused: true, open: true }),
      Dropdown({ width: DW, multiple: true, searchValue: '深圳', rows: [{ label: '深圳' }] })
    ),
    StateCard('3a  批量粘贴 · 含自定义（忽略）',
      Trigger({ width: TW, values: ['北京'], focused: true, open: true }),
      Dropdown({ width: DW, multiple: true, searchValue: '未知城市,北京', dimmedSearch: true, showCheckAll: true, checkAllLabel: '搜索结果全选', rows: [{ label: '北京', checked: true }] })
    ),
    StateCard('3b  批量粘贴 · 首项非自定义',
      Trigger({ width: TW, values: ['北京'], focused: true, open: true }),
      Dropdown({ width: DW, multiple: true, searchValue: '北京,上海,深圳', dimmedSearch: true, showCheckAll: true, checkAllLabel: '搜索结果全选', rows: [{ label: '北京', checked: true }, { label: '上海' }, { label: '深圳' }] })
    ),
    StateCard('4  回车回填结果',
      Trigger({ width: TW, values: ['北京', '上海', '深圳'] })
    ),
  ];
}

// ── Main ──────────────────────────────────────────────────────────────────────

const VARIANTS = [
  { name: 'G1 · 自定义值 · 单选',   cards: statesG1Single   },
  { name: 'G1 · 自定义值 · 多选',   cards: statesG1Multiple },
  { name: 'G2 · 精确搜索 · 单选',   cards: statesG2Single   },
  { name: 'G2 · 精确搜索 · 多选',   cards: statesG2Multiple },
];

const COL_GAP = 20;
const GROUP_GAP = 56;

async function generate() {
  await loadFonts();

  const startX = figma.viewport.center.x - 200;
  let y = figma.viewport.center.y - 300;
  const all = [];

  for (const v of VARIANTS) {
    // section title
    const title = figma.createText();
    title.fontName = { family: 'Inter', style: 'Medium' };
    title.fontSize = 14;
    title.characters = v.name;
    title.fills = [s(C.text)];
    title.x = startX;
    title.y = y;
    figma.currentPage.appendChild(title);
    all.push(title);
    y += 26;

    const cards = v.cards();
    let x = startX;
    let rowH = 0;
    for (const card of cards) {
      figma.currentPage.appendChild(card);
      card.x = x;
      card.y = y;
      all.push(card);
      x += card.width + COL_GAP;
      if (card.height > rowH) rowH = card.height;
    }
    y += rowH + GROUP_GAP;
  }

  figma.currentPage.selection = all;
  figma.viewport.scrollAndZoomIntoView(all);
}
