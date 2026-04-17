import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Select, LocaleProvider } from '@fx-ui/fine-design';
import zhCN from '@fx-ui/fine-design/es/locale/zh_CN';
import '@fx-ui/fine-design/dist/fine_design.css';
import './App.css';

const PAGE_SIZE = 30;
const cities = ['上海', '南京', '北京', '无锡'];
const companyPrefixes = ['新瑞', '恒达', '汇智', '融创', '科源', '华讯', '创智', '金盛', '盛达', '恒辉'];
const companyTypes = ['科技有限公司', '贸易有限公司', '信息技术有限公司', '实业有限公司', '电子有限公司'];

const baseOptions = Array.from({ length: 80 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  const city = cities[index % cities.length];
  const prefix = companyPrefixes[index % companyPrefixes.length];
  const type = companyTypes[index % companyTypes.length];
  const companyName = `${city}${prefix}${type}`;
  return { label: companyName, value: `company-${number}`, title: companyName };
});

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
function useBatchSearch(allOptions, multiple) {
  const [searchValue, setSearchValue] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isOpen, setIsOpen] = useState(false);
  const [batchKeywords, setBatchKeywords] = useState([]);

  const activeKeywords = useMemo(() => {
    if (batchKeywords.length) return batchKeywords;
    const kw = searchValue.trim();
    return kw ? [kw] : [];
  }, [batchKeywords, searchValue]);

  const filteredOptions = useMemo(() => {
    if (!activeKeywords.length) return allOptions;

    if (batchKeywords.length > 0) {
      // 批量粘贴模式：精准完整匹配 + label 去重
      const kwSet = new Set(batchKeywords.map(k => k.toLowerCase()));
      const seen = new Set();
      return allOptions.filter(opt => {
        const lower = opt.label.toLowerCase();
        if (!kwSet.has(lower) || seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
    } else {
      // 普通搜索模式：子串包含匹配
      const kw = searchValue.trim().toLowerCase();
      return allOptions.filter(opt =>
        `${opt.label} ${opt.value}`.toLowerCase().includes(kw)
      );
    }
  }, [activeKeywords, batchKeywords, searchValue, allOptions]);

  const visibleOptions = useMemo(
    () => filteredOptions.slice(0, visibleCount).map(opt => ({
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
      const text = (e.clipboardData ?? window.clipboardData)?.getData('text') ?? '';
      const lines = text.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
      if (lines.length <= 1) return;
      e.preventDefault();
      if (!multiple) {
        setSearchValue(lines[0]);
        setBatchKeywords([]);
      } else {
        setBatchKeywords(lines);
        setSearchValue(lines.join(', '));
      }
      setVisibleCount(PAGE_SIZE);
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [isOpen, multiple]);

  const handleSearch = useCallback((next) => {
    setBatchKeywords([]);
    setSearchValue(next);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handlePopupScroll = useCallback((e, totalLen) => {
    const t = e.currentTarget;
    if (t.scrollTop + t.clientHeight >= t.scrollHeight - 24) {
      setVisibleCount(c => Math.min(c + PAGE_SIZE, totalLen));
    }
  }, []);

  const reset = useCallback(() => {
    setSearchValue('');
    setBatchKeywords([]);
    setVisibleCount(PAGE_SIZE);
  }, []);

  return {
    searchValue, setSearchValue,
    visibleCount, setVisibleCount,
    isOpen, setIsOpen,
    batchKeywords, setBatchKeywords,
    activeKeywords, filteredOptions, visibleOptions,
    searchValueRef, batchKeywordsRef,
    handleSearch, handlePopupScroll, reset,
  };
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

  // 自定义值置顶
  const allOptions = useMemo(() => [...customOptions, ...baseOptions], [customOptions]);
  const allOptionsRef = useRef(allOptions);
  allOptionsRef.current = allOptions;

  const {
    searchValue, isOpen, setIsOpen,
    activeKeywords, filteredOptions, visibleOptions,
    searchValueRef, batchKeywordsRef,
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
    const keywords = batchKeywordsRef.current.length
      ? batchKeywordsRef.current
      : searchValueRef.current.trim() ? [searchValueRef.current.trim()] : [];
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
    batchKeywordsRef,
    filteredOptions, visibleOptions,
    handleSearch, handlePopupScroll, reset,
    isOpen,
  } = useBatchSearch(baseOptions, multiple);

  const filteredOptionsRef = useRef(filteredOptions);
  filteredOptionsRef.current = filteredOptions;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
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
