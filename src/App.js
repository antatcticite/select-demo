import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, Tag, LocaleProvider } from '@fx-ui/fine-design';
import zhCN from '@fx-ui/fine-design/es/locale/zh_CN';
import '@fx-ui/fine-design/dist/fine_design.css';
import './App.css';

const PAGE_SIZE = 30;
const cities = ['上海', '南京', '北京', '无锡'];
const companyPrefixes = ['新瑞', '恒达', '汇智', '融创', '科源', '华讯', '创智', '金盛', '盛达', '恒辉'];
const companyTypes = ['科技有限公司', '贸易有限公司', '信息技术有限公司', '实业有限公司', '电子有限公司'];

const separatorOptions = [
  { label: '测试 空格 分隔', value: 'test-space-1', title: '测试 空格 分隔' },
  { label: '测试,逗号,分隔', value: 'test-comma-1', title: '测试,逗号,分隔' },
  { label: '测试;分号;分隔', value: 'test-semicolon-1', title: '测试;分号;分隔' },
  { label: '测试, 混合 分隔; 测试', value: 'test-mix-1', title: '测试, 混合 分隔; 测试' },
];

const normalOptions = Array.from({ length: 80 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  const city = cities[index % cities.length];
  const prefix = companyPrefixes[index % companyPrefixes.length];
  const type = companyTypes[index % companyTypes.length];
  const companyName = `${city}${prefix}${type}`;
  return { label: companyName, value: `company-${number}`, title: companyName };
});

const baseOptions = (() => {
  const seen = new Set();
  const result = [];
  for (const opt of [...separatorOptions, ...normalOptions]) {
    if (!seen.has(opt.value)) {
      seen.add(opt.value);
      result.push(opt);
    }
  }
  return result;
})();

// 按 value 和 label 双重去重（label 为 JSX 时降级用 title/value）
function dedupeOptions(opts) {
  const seenVals = new Set();
  const seenLabels = new Set();
  return opts.filter(opt => {
    if (seenVals.has(opt.value)) return false;
    const labelKey = typeof opt.label === 'string' ? opt.label : (opt.title ?? opt.value);
    if (seenLabels.has(labelKey)) return false;
    seenVals.add(opt.value);
    seenLabels.add(labelKey);
    return true;
  });
}

// 将匹配的 token 包裹在 <mark> 中
function highlightText(text, tokens) {
  if (!tokens.length) return text;
  const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <span key={i} className="search-key">{part}</span>
          : part
      )}
    </span>
  );
}


// ─────────────────────────────────────────────────────
// 共用：精准匹配过滤 + 批量粘贴的 state / effect 逻辑
// ─────────────────────────────────────────────────────
function useBatchSearch(allOptions, multiple, chipMode = false) {
  const [searchValue, setSearchValue] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isOpen, setIsOpen] = useState(false);
  const [batchKeywords, setBatchKeywords] = useState([]);
  const isPasteModeRef = useRef(false);
  const pasteJoinedRef = useRef(''); // 粘贴时的原始拼接文本，用于识别"新增后缀"
  const skipNextSearchRef = useRef(false); // paste 后忽略 FineDesign 触发的首次 onSearch 回调

  const activeKeywords = useMemo(() => {
    if (batchKeywords.length) return batchKeywords;
    const kw = searchValue.trim();
    return kw ? [kw] : [];
  }, [batchKeywords, searchValue]);

  const filteredOptions = useMemo(() => {
    let result;
    if (!activeKeywords.length) {
      result = allOptions;
    } else if (batchKeywords.length > 0) {
      // 批量粘贴模式：精准完整匹配
      const kwSet = new Set(batchKeywords.map(k => k.toLowerCase()));
      result = allOptions.filter(opt => kwSet.has(opt.label.toLowerCase()));
    } else {
      // 普通搜索模式：子串包含匹配
      const kw = searchValue.trim().toLowerCase();
      result = allOptions.filter(opt =>
        `${opt.label} ${opt.value}`.toLowerCase().includes(kw)
      );
    }
    return dedupeOptions(result);
  }, [activeKeywords, batchKeywords, searchValue, allOptions]);

  const visibleOptions = useMemo(
    () => dedupeOptions(filteredOptions).slice(0, visibleCount).map(opt => ({
      ...opt,
      label: highlightText(opt.label, activeKeywords),
    })),
    [filteredOptions, visibleCount, activeKeywords],
  );

  const searchValueRef = useRef(searchValue);
  searchValueRef.current = searchValue;
  const batchKeywordsRef = useRef(batchKeywords);
  batchKeywordsRef.current = batchKeywords;

  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e) => {
      if (e.target.tagName !== 'INPUT') return;
      const text = e.clipboardData?.getData('text') ?? '';
      const lines = text.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
      if (lines.length <= 1) return;
      e.preventDefault();
      if (!multiple) {
        setSearchValue(lines[0]);
        setBatchKeywords([]);
      } else {
        setBatchKeywords(lines);
        if (chipMode) {
          setSearchValue(' ');   // 非空占位符，让 FD 进入"搜索模式"使 checkAllContent 生效
          pasteJoinedRef.current = '';
          skipNextSearchRef.current = true;
        } else {
          const joined = lines.join(', ');
          setSearchValue(joined);
          pasteJoinedRef.current = joined;
        }
        isPasteModeRef.current = true;
      }
      setVisibleCount(PAGE_SIZE);
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [isOpen, multiple]);

  const handleSearch = useCallback((next) => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      // chip 模式下 FD 可能回调 onSearch('') 覆盖空格占位符，忽略空值回调
      if (!chipMode || next.trim()) setSearchValue(next);
      setVisibleCount(PAGE_SIZE);
      return;
    }
    if (!next.trim()) {
      setBatchKeywords([]);
      isPasteModeRef.current = false;
      pasteJoinedRef.current = '';
    } else if (isPasteModeRef.current) {
      // 粘贴模式：忽略非空更新，保持搜索框锁定（防止字符被渲染出来）
      setVisibleCount(PAGE_SIZE);
      return;
    } else {
      setBatchKeywords([]);
    }
    setSearchValue(next);
    setVisibleCount(PAGE_SIZE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipMode]);

  const handlePopupScroll = useCallback((e, totalLen) => {
    const t = e.currentTarget;
    if (t.scrollTop + t.clientHeight >= t.scrollHeight - 24) {
      setVisibleCount(c => Math.min(c + PAGE_SIZE, totalLen));
    }
  }, []);

  const removeKeyword = useCallback((kw) => {
    const remaining = batchKeywordsRef.current.filter(k => k !== kw);
    if (remaining.length === 0) {
      setSearchValue('');
      isPasteModeRef.current = false;
      pasteJoinedRef.current = '';
    }
    setBatchKeywords(remaining);
  }, []);

  const reset = useCallback(() => {
    setSearchValue('');
    setBatchKeywords([]);
    setVisibleCount(PAGE_SIZE);
    isPasteModeRef.current = false;
  }, []);

  return {
    searchValue, setSearchValue,
    visibleCount, setVisibleCount,
    isOpen, setIsOpen,
    batchKeywords, setBatchKeywords,
    activeKeywords, filteredOptions, visibleOptions,
    searchValueRef, batchKeywordsRef, pasteJoinedRef,
    handleSearch, handlePopupScroll, reset, removeKeyword,
  };
}

// 粘贴的关键词以可删除 chip 展示，单行显示，超出折叠为 +N
function BatchKwChips({ keywords, onRemove }) {
  const rowRef = useRef(null);
  const [maxVisible, setMaxVisible] = useState(null); // null = 未测量，先渲染全部

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !keywords.length) { setMaxVisible(null); return; }

    const chips = [...row.querySelectorAll('[data-chip]')];
    if (!chips.length) return;

    const containerWidth = row.offsetWidth;
    const containerLeft = row.getBoundingClientRect().left;
    const BADGE_W = 40; // "+N" badge 占用宽度估算

    // 所有 chip 都放得下 → 不需要 badge
    const lastRight = chips[chips.length - 1].getBoundingClientRect().right - containerLeft;
    if (lastRight <= containerWidth + 1) {
      setMaxVisible(chips.length);
      return;
    }

    // 保留 badge 空间，找出能放下的最多数量
    const limit = containerWidth - BADGE_W;
    let count = 0;
    for (const chip of chips) {
      if (chip.getBoundingClientRect().right - containerLeft <= limit + 1) count++;
      else break;
    }
    setMaxVisible(Math.max(1, count));
  }, [keywords]);

  if (!keywords?.length) return null;

  const shown = keywords.slice(0, maxVisible ?? keywords.length);
  const overflow = keywords.length - shown.length;

  return (
    <div className="dd-batch-chips-in-search" ref={rowRef}>
      {shown.map(kw => (
        <span key={kw} data-chip className="dd-batch-chip">
          <span className="dd-batch-chip-text">{kw}</span>
          <span
            className="dd-batch-chip-remove"
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onRemove(kw); }}
          >×</span>
        </span>
      ))}
      {overflow > 0 && (
        <span className="dd-batch-chip-overflow">+{overflow}</span>
      )}
    </div>
  );
}

// 下拉中的自定义值：以 tag chip 展示，点击整行一起添加
function CustomKwTagRow({ keywords, onClickAll }) {
  if (!keywords || keywords.length === 0) return null;
  return (
    <div
      className="dd-custom-tag-row dd-custom-tag-row-clickable"
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onClickAll(); }}
    >
      <span className="dd-custom-kw-label">自定义值：</span>
      <div className="dd-custom-tag-list">
        {keywords.map(kw => (
          <span key={kw} className="dd-custom-tag-chip">{kw}</span>
        ))}
      </div>
    </div>
  );
}

// "自定义值：xxx" 提示行（仅 CustomValueSelectCard 使用）
// onClick：点击该行可单独新增并选中自定义值（不影响已匹配项的选中状态）
function CustomKwHeader({ keywords, onClick }) {
  if (!keywords || keywords.length === 0) return null;
  return (
    <div
      className={`dd-custom-kw${onClick ? ' dd-custom-kw-clickable' : ''}`}
      onClick={onClick}
    >
      <span className="dd-custom-kw-label">自定义值：</span>
      {keywords.map((kw, i) => (
        <React.Fragment key={kw}>
          {i > 0 && <span className="dd-custom-kw-sep">，</span>}
          <span className="search-key">{kw}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// 第二组：批量粘贴 → 回车批量新增自定义值并选中
// ─────────────────────────────────────────────────────
function CustomValueSelectCard({ title, description, multiple = false }) {
  const [customOptions, setCustomOptions] = useState([]);
  const [value, setValue] = useState(multiple ? [] : undefined);

  // 自定义值置顶，确保无重复
  const allOptions = useMemo(() => {
    return dedupeOptions([...customOptions, ...baseOptions]);
  }, [customOptions]);
  const allOptionsRef = useRef(allOptions);
  allOptionsRef.current = allOptions;

  const {
    searchValue, isOpen, setIsOpen,
    activeKeywords, filteredOptions, visibleOptions,
    searchValueRef, batchKeywordsRef, pasteJoinedRef,
    handleSearch, handlePopupScroll, reset,
  } = useBatchSearch(allOptions, multiple);

  // 关键词中没有精准匹配的部分 → 将成为自定义值
  const newCustomKeywords = useMemo(
    () => activeKeywords.filter(kw =>
      !allOptions.some(o => o.label.toLowerCase() === kw.toLowerCase())
    ),
    [activeKeywords, allOptions],
  );

  const commit = useCallback(() => {
    let keywords;
    if (batchKeywordsRef.current.length) {
      // 粘贴模式：用原始 batchKeywords + 用户在末尾手动追加的新内容（后缀）
      const suffix = searchValueRef.current.startsWith(pasteJoinedRef.current)
        ? searchValueRef.current.slice(pasteJoinedRef.current.length).replace(/^[,，\s]+/, '').trim()
        : '';
      keywords = suffix ? [...batchKeywordsRef.current, suffix] : batchKeywordsRef.current;
    } else {
      keywords = searchValueRef.current.trim() ? [searchValueRef.current.trim()] : [];
    }
    if (!keywords.length) return;
    if (!keywords.length) return;

    const toAdd = multiple ? keywords : [keywords[0]];
    const currentAll = allOptionsRef.current;

    const newOpts = toAdd
      .filter(kw => !currentAll.some(o => o.label.toLowerCase() === kw.toLowerCase()))
      .map(kw => ({ label: kw, value: `custom:${kw}`, title: kw }));
    if (newOpts.length) setCustomOptions(prev => [...prev, ...newOpts]);

    const toSelect = toAdd.map(kw => {
      const found = currentAll.find(o => o.label.toLowerCase() === kw.toLowerCase());
      return found
        ? { label: found.label, value: found.value }
        : { label: kw, value: `custom:${kw}` };
    });

    if (multiple) {
      setValue(prev => {
        const prevVals = new Set((prev || []).map(v => v.value));
        return [...(prev || []), ...toSelect.filter(s => !prevVals.has(s.value))];
      });
    } else {
      setValue(toSelect[0] ?? undefined);
    }
    reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiple, reset]); // batchKeywordsRef/searchValueRef 是 ref，不需要列为依赖

  // 仅新增并选中自定义值（不影响已匹配的已有选项）
  const commitCustomOnly = useCallback(() => {
    if (!newCustomKeywords.length) return;
    // 单选只取第一个关键词
    const kwToAdd = multiple ? newCustomKeywords : [newCustomKeywords[0]];
    const newOpts = kwToAdd.map(kw => ({
      label: kw, value: `custom:${kw}`, title: kw,
    }));
    setCustomOptions(prev => [
      ...prev,
      ...newOpts.filter(o => !prev.some(p => p.value === o.value)),
    ]);
    if (multiple) {
      setValue(prev => {
        const prevVals = new Set((prev || []).map(v => v.value));
        return [...(prev || []), ...newOpts.filter(o => !prevVals.has(o.value))];
      });
    } else {
      setValue(newOpts[0]);
    }
    reset();
  }, [newCustomKeywords, multiple, reset]);

  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (batchKeywordsRef.current.length > 0 &&
          (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      const shouldCommit = batchKeywordsRef.current.length > 0
        || searchValueRef.current.trim();
      if (shouldCommit) {
        commitRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // refs 不需要列为依赖

  return (
    <section className="field">
      <div className="field-title">{title}</div>
      <div className="field-desc">{description}</div>
      <Select
        style={{ width: 522 }}
        placeholder="请选择"
        multiple={multiple}
        checkable={multiple}
        hasCheckAll={multiple ? true : undefined}
        checkAllContent={multiple && activeKeywords.length > 0 ? '搜索结果全选' : undefined}
        showSearch
        searchValue={searchValue}
        searchInputPlaceholder={
          multiple
            ? '粘贴关键词（换行分隔），Enter 批量添加并选中'
            : '粘贴关键词，Enter 添加为自定义值并选中'
        }
        filterOption={false}
        allowClear
        options={visibleOptions}
        labelInValue
        value={value}
        onSearch={handleSearch}
        onPopupScroll={(e) => handlePopupScroll(e, filteredOptions.length)}
        onDropdownVisibleChange={(open) => {
          setIsOpen(open);
          if (!open) {
            // 收起时清除未被选中的自定义值，防止污染选项列表
            const selectedVals = new Set(
              multiple
                ? (value || []).map(v => v.value)
                : value ? [value.value] : []
            );
            setCustomOptions(prev =>
              prev.filter(o => selectedVals.has(o.value))
            );
            reset();
          }
        }}
        onChange={(next) => {
          const normalize = (v) => ({
            ...v,
            label: allOptions.find(o => o.value === v.value)?.label ?? String(v.value),
          });
          if (multiple) setValue((next || []).map(normalize));
          else setValue(next ? normalize(next) : undefined);
        }}
        dropdownRender={(menu) => (
          <div className="dd-dropdown-flex">
            {menu}
            <CustomKwHeader keywords={newCustomKeywords} onClick={commitCustomOnly} />
          </div>
        )}
      />
    </section>
  );
}


// ─────────────────────────────────────────────────────
// 第二组：精准搜索 · 不支持自定义值
// ─────────────────────────────────────────────────────
function PreciseSearchSelectCard({ title, description, multiple = false }) {
  const [value, setValue] = useState(multiple ? [] : undefined);

  const {
    searchValue, setIsOpen,
    batchKeywordsRef, activeKeywords,
    filteredOptions, visibleOptions,
    handleSearch, handlePopupScroll, reset,
    isOpen,
  } = useBatchSearch(baseOptions, multiple);

  const filteredOptionsRef = useRef(filteredOptions);
  filteredOptionsRef.current = filteredOptions;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (batchKeywordsRef.current.length > 0 &&
          (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      if (batchKeywordsRef.current.length > 0) {
        const matched = filteredOptionsRef.current.map(o => ({ label: o.title ?? String(o.label), value: o.value }));
        if (!matched.length) return;
        if (multiple) {
          setValue(prev => {
            const prevVals = new Set((prev || []).map(v => v.value));
            return [...(prev || []), ...matched.filter(m => !prevVals.has(m.value))];
          });
        } else {
          setValue(matched[0]);
        }
        reset();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, multiple, reset]); // refs 不需要列为依赖

  return (
    <section className="field">
      <div className="field-title">{title}</div>
      <div className="field-desc">{description}</div>
      <Select
        style={{ width: 522 }}
        placeholder="请选择"
        multiple={multiple}
        checkable={multiple}
        hasCheckAll={multiple ? true : undefined}
        checkAllContent={multiple && activeKeywords.length > 0 ? '搜索结果全选' : undefined}
        showSearch
        searchValue={searchValue}
        searchInputPlaceholder={
          multiple
            ? '粘贴关键词（换行分隔），精准命中后选中'
            : '粘贴关键词，精准命中后选中'
        }
        filterOption={false}
        allowClear
        options={visibleOptions}
        labelInValue
        value={value}
        onSearch={handleSearch}
        onPopupScroll={(e) => handlePopupScroll(e, filteredOptions.length)}
        onDropdownVisibleChange={(open) => {
          setIsOpen(open);
          if (!open) reset();
        }}
        onChange={(next) => {
          const normalize = (v) => ({
            ...v,
            label: baseOptions.find(o => o.value === v.value)?.label ?? String(v.value),
          });
          if (multiple) setValue((next || []).map(normalize));
          else setValue(next ? normalize(next) : undefined);
        }}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────
// 第三/四组：Tags 回填模式（参数化）
//   multiple   - true: 多选 tags 模式；false: 普通单选
//   allowCustom - true: 不命中时新增自定义值；false: 仅精准命中可选
// ─────────────────────────────────────────────────────
function TagsSelectCard({ title, description, multiple = true, allowCustom = true }) {
  const [customOptions, setCustomOptions] = useState([]);
  const [value, setValue] = useState(multiple ? [] : undefined);

  const allOptions = useMemo(
    () => dedupeOptions([...customOptions, ...baseOptions]),
    [customOptions],
  );
  const allOptionsRef = useRef(allOptions);
  allOptionsRef.current = allOptions;

  // chipMode 仅在多选时有意义（单选粘贴只取第一行）
  const {
    searchValue, isOpen, setIsOpen,
    batchKeywords,
    activeKeywords, filteredOptions, visibleOptions,
    searchValueRef, batchKeywordsRef, pasteJoinedRef,
    handleSearch, handlePopupScroll, reset, removeKeyword,
  } = useBatchSearch(allOptions, multiple, multiple);

  // "全部"tag：仅多选时有效
  const isAllSelected = useMemo(
    () => multiple && Array.isArray(value) && visibleOptions.length > 0 &&
          visibleOptions.every(o => value.some(v => v.value === o.value)),
    [multiple, visibleOptions, value],
  );

  // portal 目标节点（chipMode = multiple）
  const wrapperRef = useRef(null);
  const [inputContent, setInputContent] = useState(null);
  useLayoutEffect(() => {
    if (!isOpen || !multiple) { setInputContent(null); return; }
    const el = wrapperRef.current?.querySelector(
      '.x-select-dropdown-search-input .input-content'
    );
    setInputContent(prev => (prev === el ? prev : (el ?? null)));
  }, [isOpen, multiple]);

  // 未命中已有选项的关键词（仅 allowCustom 时使用）
  const newCustomKeywords = useMemo(
    () => allowCustom
      ? activeKeywords.filter(kw =>
          !allOptions.some(o => o.label.toLowerCase() === kw.toLowerCase())
        )
      : [],
    [allowCustom, activeKeywords, allOptions],
  );
  const newCustomKeywordsRef = useRef(newCustomKeywords);
  newCustomKeywordsRef.current = newCustomKeywords;

  const commit = useCallback(() => {
    let keywords;
    if (batchKeywordsRef.current.length) {
      const suffix = searchValueRef.current.startsWith(pasteJoinedRef.current)
        ? searchValueRef.current.slice(pasteJoinedRef.current.length).replace(/^[,，\s]+/, '').trim()
        : '';
      keywords = suffix ? [...batchKeywordsRef.current, suffix] : batchKeywordsRef.current;
    } else {
      keywords = searchValueRef.current.trim() ? [searchValueRef.current.trim()] : [];
    }
    if (!keywords.length) return;
    if (!multiple) keywords = [keywords[0]]; // 单选只取第一个

    const currentAll = allOptionsRef.current;

    if (allowCustom) {
      const newOpts = keywords
        .filter(kw => !currentAll.some(o => o.label.toLowerCase() === kw.toLowerCase()))
        .map(kw => ({ label: kw, value: `custom:${kw}`, title: kw }));
      if (newOpts.length) setCustomOptions(prev => [...prev, ...newOpts]);

      const toSelect = keywords.map(kw => {
        const found = currentAll.find(o => o.label.toLowerCase() === kw.toLowerCase());
        return found ? { label: found.label, value: found.value } : { label: kw, value: `custom:${kw}` };
      });
      if (multiple) {
        setValue(prev => {
          const prevVals = new Set((prev || []).map(v => v.value));
          return [...(prev || []), ...toSelect.filter(s => !prevVals.has(s.value))];
        });
      } else {
        setValue(toSelect[0] ?? undefined);
      }
    } else {
      // 仅选中精准匹配的选项，不新增自定义值
      const toSelect = keywords
        .map(kw => {
          const found = currentAll.find(o => o.label.toLowerCase() === kw.toLowerCase());
          return found ? { label: found.label, value: found.value } : null;
        })
        .filter(Boolean);
      if (!toSelect.length) { reset(); return; }
      if (multiple) {
        setValue(prev => {
          const prevVals = new Set((prev || []).map(v => v.value));
          return [...(prev || []), ...toSelect.filter(s => !prevVals.has(s.value))];
        });
      } else {
        setValue(toSelect[0]);
      }
    }
    reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiple, allowCustom, reset]);

  // 仅添加自定义值行（整行点击，不触及精准匹配项）
  const commitCustomOnly = useCallback(() => {
    if (!allowCustom) return;
    const kws = newCustomKeywordsRef.current;
    if (!kws.length) return;
    const toAdd = multiple ? kws : [kws[0]];
    const newOpts = toAdd.map(kw => ({ label: kw, value: `custom:${kw}`, title: kw }));
    setCustomOptions(prev => [...prev, ...newOpts.filter(o => !prev.some(p => p.value === o.value))]);
    if (multiple) {
      setValue(prev => {
        const prevVals = new Set((prev || []).map(v => v.value));
        return [...(prev || []), ...newOpts.filter(o => !prevVals.has(o.value))];
      });
    } else {
      setValue(newOpts[0]);
    }
    reset();
  }, [allowCustom, multiple, reset]);

  const commitRef = useRef(commit);
  commitRef.current = commit;

  // 追踪"全选"激活状态（多选专用）
  const isCheckAllActiveRef = useRef(false);

  useEffect(() => {
    if (!multiple || !isCheckAllActiveRef.current) return;
    setValue(prev => {
      const prevVals = new Set(prev.map(v => v.value));
      const toAdd = visibleOptions
        .filter(o => !prevVals.has(o.value))
        .map(o => ({
          value: o.value,
          label: allOptionsRef.current.find(a => a.value === o.value)?.label ?? String(o.value),
        }));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleOptions]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (batchKeywordsRef.current.length > 0 &&
          (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      if (batchKeywordsRef.current.length > 0 || searchValueRef.current.trim()) {
        commitRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const normalizeVal = useCallback((v) => ({
    ...v,
    label: allOptions.find(o => o.value === v.value)?.label ?? String(v.value),
  }), [allOptions]);

  return (
    <section className="field">
      <div className="field-title">{title}</div>
      <div className="field-desc">{description}</div>
      <div className="select-all-wrapper" style={{ width: 522 }}>
        {isAllSelected && (
          <span className="trigger-all-tag">
            <Tag type="primary" closable={false}>全部</Tag>
          </span>
        )}
        <Select
          style={{ width: '100%' }}
          placeholder="请选择"
          multiple={multiple || undefined}
          tags={multiple || undefined}
          checkable={multiple || undefined}
          hasCheckAll={multiple || undefined}
          checkAllContent={multiple && activeKeywords.length > 0 ? '搜索结果全选' : undefined}
          maxTagCount={multiple ? 'responsive' : undefined}
          showSearch
          searchValue={searchValue}
          searchInputPlaceholder={
            multiple
              ? '粘贴关键词（换行分隔），Enter 批量添加并选中'
              : '粘贴关键词，Enter 添加并选中'
          }
          filterOption={false}
          allowClear
          options={visibleOptions}
          labelInValue
          value={value}
          onSearch={(val) => { isCheckAllActiveRef.current = false; handleSearch(val); }}
          onPopupScroll={(e) => handlePopupScroll(e, filteredOptions.length)}
          onDropdownVisibleChange={(open) => {
            setIsOpen(open);
            if (!open) {
              isCheckAllActiveRef.current = false;
              if (allowCustom) {
                const selectedVals = new Set(
                  multiple
                    ? (value || []).map(v => v.value)
                    : value ? [value.value] : []
                );
                setCustomOptions(prev => prev.filter(o => selectedVals.has(o.value)));
              }
              reset();
            }
          }}
          onChange={(next) => {
            if (multiple) {
              const normalized = (next || []).map(normalizeVal);
              isCheckAllActiveRef.current = normalized.length > 0 &&
                visibleOptions.every(o => normalized.some(n => n.value === o.value));
              setValue(normalized);
            } else {
              setValue(next ? normalizeVal(next) : undefined);
            }
          }}
          dropdownRender={(menu) => (
            <div
              className={`dd-dropdown-flex${batchKeywords.length > 0 ? ' dd-batch-mode' : ''}`}
              ref={wrapperRef}
            >
              {menu}
              {inputContent && batchKeywords.length > 0
                ? createPortal(
                    <>
                      <BatchKwChips keywords={batchKeywords} onRemove={removeKeyword} />
                      <span
                        className="dd-batch-chips-clear"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); reset(); }}
                      >×</span>
                    </>,
                    inputContent
                  )
                : null}
              {allowCustom && newCustomKeywords.length > 0 && (
                <CustomKwTagRow keywords={newCustomKeywords} onClickAll={commitCustomOnly} />
              )}
            </div>
          )}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────
// 简易折叠组件
// ─────────────────────────────────────────────────────
function CustomCollapse({ header, children }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="custom-collapse" style={{ marginBottom: 32 }}>
      <div 
        className="custom-collapse-header" 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center',
          gap: 8,
          color: '#6b7280',
          fontSize: '14px',
          fontWeight: 500,
          padding: '12px 16px',
          background: '#f9fafb',
          borderRadius: '8px',
          userSelect: 'none'
        }}
      >
        <span style={{ 
          fontSize: '10px',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>▶</span>
        {header}
      </div>
      {expanded && (
        <div className="custom-collapse-content" style={{ marginTop: 24, padding: '0 4px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────────────
const baseOptionsText = baseOptions.map(o => o.label).join('\n');

function App() {
  const [optionsText, setOptionsText] = useState(baseOptionsText);

  return (
    <LocaleProvider locale={zhCN}>
      <main className="page">
        <header className="page-head">
          <h1>数分业务组件select原型</h1>
          <p>两组单/多选 Select 对比：精准命中选项，不命中时是否允许新增自定义值。</p>
        </header>

        <div className="group">
          <div className="group-label">
            <span className="group-tag">第一组</span>
            批量粘贴 · 精准命中选中已有选项 · 不命中则新增为自定义值
          </div>
          <div className="stack">
            <CustomValueSelectCard
              title="单选（仅首个关键词）"
              description="粘贴后仅取第一行；命中已有选项则选中，否则回车新增为自定义值。"
              multiple={false}
            />
            <CustomValueSelectCard
              title="多选（全部关键词）"
              description="粘贴多行关键词；命中已有选项则选中，不命中的回车后新增为自定义值。"
              multiple
            />
          </div>
        </div>

        <div className="group">
          <div className="group-label">
            <span className="group-tag">第二组</span>
            批量粘贴 · 仅精准命中项显示 · 不支持新增自定义值
          </div>
          <div className="stack">
            <PreciseSearchSelectCard
              title="单选"
              description="粘贴后仅取第一行；仅精准命中的选项显示，不支持新增自定义值。"
              multiple={false}
            />
            <PreciseSearchSelectCard
              title="多选"
              description="粘贴多行关键词；仅精准命中的选项显示，不支持新增自定义值。"
              multiple
            />
          </div>
        </div>

        <CustomCollapse header="更多筛选器原型（第三/四组）">
          <div className="group">
            <div className="group-label">
              <span className="group-tag">第三组</span>
              Tag 回填 · 精准命中选中已有选项 · 不命中则新增为自定义值
            </div>
            <div className="stack">
              <TagsSelectCard
                title="单选"
                description="粘贴后仅取第一行；命中已有选项则选中，否则回车新增为自定义值。"
                multiple={false}
              />
              <TagsSelectCard
                title="多选（Tag 回填）"
                description="选中项以 tag 形式展示；下拉中自定义值也以 tag chip 显示，点击整行一起添加。"
              />
            </div>
          </div>

          <div className="group">
            <div className="group-label">
              <span className="group-tag">第四组</span>
              Tag 回填 · 仅精准命中项显示 · 不支持新增自定义值
            </div>
            <div className="stack">
              <TagsSelectCard
                title="单选"
                description="粘贴后仅取第一行；仅精准命中的选项可选，不支持新增自定义值。"
                multiple={false}
                allowCustom={false}
              />
              <TagsSelectCard
                title="多选（Tag 回填）"
                description="粘贴多行关键词精准匹配；仅命中的选项显示，不支持新增自定义值。"
                allowCustom={false}
              />
            </div>
          </div>
        </CustomCollapse>

        <div className="options-editor">
          <div className="options-editor-label">选项列表（可编辑，复制后粘贴到上方 Select 中测试）</div>
          <textarea
            className="options-editor-textarea"
            value={optionsText}
            onChange={e => setOptionsText(e.target.value)}
            spellCheck={false}
          />
        </div>
      </main>
    </LocaleProvider>
  );
}

export default App;
