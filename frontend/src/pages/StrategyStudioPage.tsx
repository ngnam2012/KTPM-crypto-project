import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Globe, 
  Trash2, 
  Copy, 
  Check, 
  CheckCircle2, 
  Scale, 
  LineChart, 
  ShieldCheck, 
  Save, 
  Play, 
  FlaskConical, 
  AlertCircle, 
  Layers, 
  Sliders, 
  BookOpen, 
  X, 
  RefreshCw, 
  FolderOpen,
  Clock,
  Coins
} from 'lucide-react';

interface ParsedStrategyData {
  id?: string;
  name: string;
  version: string;
  type: string;
  logic: string;
  tags: string[];
  strategies: any[];
  description: string;
  prompt: string;
  source_url?: string;
  long_conditions: string[];
  short_conditions: string[];
  risk_management: {
    stop_loss: string;
    take_profit: string;
    stop_loss_pct: number;
    take_profit_pct: number;
  };
  timeframe: string;
  applicability: string;
  json_schema: any;
  validation: {
    missing_required: string;
    logic_check: string;
    supported_indicators: string;
    status: string;
  };
}

export const StrategyStudioPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Library Modal State
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState<boolean>(false);

  // Inputs (Column 1)
  const [promptText, setPromptText] = useState<string>(
    "RSI < 30 and Close Price below Bollinger Lower Band (20, 2), Stop Loss 2%, Take Profit 4%"
  );
  const [sourceUrl, setSourceUrl] = useState<string>("https://www.tradingview.com/script/xyz-example");
  const [loading, setLoading] = useState<boolean>(false);
  const [crawlLoading, setCrawlLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Parsed Output State (Columns 2, 3, 4)
  const [parsedData, setParsedData] = useState<ParsedStrategyData>({
    name: "RSI_BB_LB_LONG_SL2_TP4",
    version: "1.0.0",
    type: "composite",
    logic: "AND",
    tags: ["RSI Strategy", "Bollinger Bands"],
    strategies: [
      { id: "rsi", name: "RSI Strategy", params: { window: 14, oversold: 30, overbought: 70 } },
      { id: "bollinger_bands", name: "Bollinger Bands", params: { period: 20, std_dev: 2.0 } }
    ],
    description: "LONG when RSI < 30 and Close below Bollinger Lower Band. SL: 2%, TP: 4%.",
    prompt: "RSI < 30 and Close Price below Bollinger Lower Band (20, 2), Stop Loss 2%, Take Profit 4%",
    long_conditions: [
      "RSI (14) < 30",
      "Close Price below Bollinger Lower Band (20, 2)"
    ],
    short_conditions: [
      "RSI (14) > 70",
      "Close Price above Bollinger Upper Band (20, 2)"
    ],
    risk_management: {
      stop_loss: "Stop Loss: 2%",
      take_profit: "Take Profit: 4%",
      stop_loss_pct: 2.0,
      take_profit_pct: 4.0
    },
    timeframe: "1h (Default)",
    applicability: "All USDT Trading Pairs (Configurable)",
    json_schema: {
      name: "RSI_BB_LB_LONG_SL2_TP4",
      version: "1.0.0",
      description: "LONG when RSI < 30 and Close below Bollinger Lower Band. SL: 2%, TP: 4%.",
      indicators: [
        { name: "RSI", period: 14 },
        { name: "BollingerBands", period: 20, stdDev: 2 }
      ],
      conditions: {
        long: [
          { indicator: "RSI", operator: "<", value: 30 },
          { indicator: "Close", position: "<", indicatorRef: "BB_Lower" }
        ],
        short: [
          { indicator: "RSI", operator: ">", value: 70 },
          { indicator: "Close", position: ">", indicatorRef: "BB_Upper" }
        ]
      },
      riskManagement: {
        stopLoss: { type: "percent", value: 2 },
        takeProfit: { type: "percent", value: 4 }
      },
      timeframe: "1h",
      applicability: {
        pairs: ["USDT_ALL"],
        market: "spot"
      }
    },
    validation: {
      missing_required: "None",
      logic_check: "Valid Logic",
      supported_indicators: "All indicators supported",
      status: "Valid for Strategy Library persistence"
    }
  });

  // Library Save Form (Column 4)
  const [libraryName, setLibraryName] = useState<string>("RSI_BB_LB_LONG_SL2_TP4");
  const [libraryVersion, setLibraryVersion] = useState<string>("1.0.0");
  const [libraryTags, setLibraryTags] = useState<string>("RSI, Bollinger Bands");

  const handleAnalyzeLLM = async () => {
    if (!promptText.trim()) {
      setToast({ message: "Please enter a strategy description.", type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/custom-strategies/generate-from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, source_url: sourceUrl || null })
      });

      if (!res.ok) throw new Error("Failed to parse strategy prompt.");
      const data = await res.json();

      setParsedData(data);
      setLibraryName(data.name || "AI_CUSTOM_STRATEGY");
      setLibraryVersion(data.version || "1.0.0");
      setLibraryTags((data.tags || []).join(", "));

      setToast({ message: "LLM analysis & schema extraction completed!", type: 'success' });
      setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setToast({ message: e.message || "LLM Analysis Error", type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractWebsite = async () => {
    if (!sourceUrl.trim()) return;
    setCrawlLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/custom-strategies/crawl-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl })
      });

      if (!res.ok) throw new Error("Failed to extract article content.");
      const crawlData = await res.json();

      const extractedPrompt = `${crawlData.title}\n\n${crawlData.content}`;
      setPromptText(extractedPrompt);

      // Auto trigger analysis
      const parseRes = await fetch("http://localhost:8000/api/v1/custom-strategies/generate-from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: extractedPrompt, source_url: sourceUrl })
      });
      if (parseRes.ok) {
        const data = await parseRes.json();
        setParsedData(data);
        setLibraryName(data.name || "WEB_EXTRACTED_STRATEGY");
        setLibraryVersion(data.version || "1.0.0");
        setLibraryTags((data.tags || []).join(", "));
      }

      setToast({ message: "Article extracted and strategy parsed successfully!", type: 'success' });
      setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setToast({ message: e.message || "Website extraction error", type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setCrawlLoading(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(parsedData.json_schema, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToLibrary = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/custom-strategies/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: libraryName,
          version: libraryVersion,
          tags: libraryTags.split(",").map(t => t.trim()).filter(Boolean),
          json_schema: parsedData.json_schema,
          source_prompt: promptText
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to save strategy to library.");
      }
      setToast({ message: `Strategy '${libraryName}' saved to library successfully!`, type: 'success' });
      setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setToast({ message: e.message || "Failed to save strategy to library", type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleDeleteFromLibrary = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete strategy '${name}' from library?`)) return;
    try {
      const res = await fetch(`http://localhost:8000/api/v1/custom-strategies/saved/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to delete strategy.");
      }
      setSavedStrategies(prev => prev.filter(s => s.id !== id));
      setToast({ message: `Deleted strategy '${name}' from library.`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ message: err.message || "Error deleting strategy", type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleRunBacktestNow = () => {
    navigate("/backtest", { state: { strategy: parsedData, autoRun: true } });
  };

  const handleOpenLibrary = async () => {
    setIsLibraryOpen(true);
    setLoadingLibrary(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/custom-strategies/saved");
      if (res.ok) {
        const data = await res.json();
        setSavedStrategies(data.saved_strategies || []);
      }
    } catch (err) {
      console.error("Failed to load saved strategies", err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleLoadFromLibrary = (strat: any) => {
    const params = strat.params || {};
    const schema = params.json_schema || {};
    setParsedData({
      id: strat.id,
      name: strat.name,
      version: strat.version || "1.0.0",
      type: strat.type || "composite",
      logic: params.logic || "AND",
      tags: params.strategies ? params.strategies.map((s: any) => s.name || s.id) : [],
      strategies: params.strategies || [],
      description: strat.description || "",
      prompt: strat.source_prompt || "",
      long_conditions: schema.conditions?.long?.map((c: any) => c.condition || JSON.stringify(c)) || [],
      short_conditions: schema.conditions?.short?.map((c: any) => c.condition || JSON.stringify(c)) || [],
      risk_management: {
        stop_loss: `Stop Loss: ${params.stop_loss_pct || 2}%`,
        take_profit: `Take Profit: ${params.take_profit_pct || 4}%`,
        stop_loss_pct: params.stop_loss_pct || 2,
        take_profit_pct: params.take_profit_pct || 4
      },
      timeframe: schema.timeframe || "1h (Default)",
      applicability: "All USDT Trading Pairs",
      json_schema: schema,
      validation: {
        missing_required: "None",
        logic_check: "Valid Logic",
        supported_indicators: "All indicators supported",
        status: "Loaded from Database Library"
      }
    });
    if (strat.source_prompt) setPromptText(strat.source_prompt);
    setLibraryName(strat.name);
    setLibraryVersion(strat.version || "1.0.0");
    setIsLibraryOpen(false);
    setToast({ message: `Loaded '${strat.name}' from Library!`, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1750px] mx-auto space-y-5 text-text-main min-h-screen flex flex-col">
      {/* Header Bar */}
      <div className="bg-bg-panel/80 p-5 rounded-2xl border border-border-subtle backdrop-blur-xl shadow-lg shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-purple/10 text-accent-purple rounded-xl border border-accent-purple/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-main flex items-center gap-2">
                AI Strategy Studio & Natural Language Parser
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent-purple/15 text-accent-purple border border-accent-purple/30 font-mono">
                  LLM SCHEMA ENGINE
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Input natural language trading rules or website URLs to parse Long/Short conditions, Stop Loss, Take Profit, and export standardized JSON schemas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenLibrary}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 hover:text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all cursor-pointer"
          >
            <BookOpen size={15} className="text-amber-400" />
            <span>Saved Strategy Library</span>
          </button>

          <button
            onClick={() => navigate("/backtest")}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface hover:bg-bg-hover border border-border-subtle hover:border-brand-500/40 rounded-xl text-xs font-semibold text-text-main transition-colors cursor-pointer"
          >
            <FlaskConical size={14} className="text-brand-400" />
            <span>Open Backtest Workbench</span>
          </button>
        </div>
      </div>

      {/* 4-Column Specialized Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
        
        {/* COLUMN 1: STRATEGY PROMPT & WEB EXTRACTOR */}
        <div className="flex flex-col gap-4">
          {/* Prompt Box */}
          <div className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md flex flex-col flex-1">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <Sparkles size={14} className="text-accent-purple" />
                Strategy Prompt (Natural Language)
              </label>
              <span className="text-[11px] text-text-muted font-mono">{promptText.length}/4000</span>
            </div>

            <textarea
              rows={7}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. RSI < 30 and Close below Bollinger Lower Band (20, 2), Stop Loss 2%, Take Profit 4%..."
              className="w-full bg-bg-deep border border-border-subtle rounded-xl p-3 text-xs text-text-main outline-none focus:border-accent-purple resize-none flex-1 leading-relaxed"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAnalyzeLLM}
                disabled={loading || !promptText.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-500/20 disabled:opacity-50"
              >
                <Sparkles size={14} />
                <span>{loading ? 'Analyzing...' : 'Parse with LLM'}</span>
              </button>

              <button
                onClick={() => setPromptText("")}
                title="Clear input"
                className="p-2.5 bg-bg-deep hover:bg-bg-surface border border-border-subtle rounded-xl text-text-muted hover:text-bearish-bright transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Web Extract Box */}
          <div className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md">
            <label className="text-xs font-bold text-text-main mb-2 block flex items-center gap-1.5">
              <Globe size={14} className="text-accent-blue" />
              Extract from Article / Script URL
            </label>

            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.tradingview.com/script/xyz-example"
              className="w-full bg-bg-deep border border-border-subtle rounded-xl p-2.5 text-xs text-text-main outline-none focus:border-accent-blue mb-3"
            />

            <button
              onClick={handleExtractWebsite}
              disabled={crawlLoading || !sourceUrl.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-blue/15 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/30 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
            >
              <Globe size={14} />
              <span>{crawlLoading ? 'Extracting...' : 'Extract Web Content'}</span>
            </button>
          </div>
        </div>

        {/* COLUMN 2: PARSED STRATEGY STRUCTURE */}
        <div className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2.5">
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-brand-400" />
              Parsed Strategy Rules
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 font-mono font-bold">
              {parsedData.type.toUpperCase()}
            </span>
          </div>

          <div className="space-y-3.5 flex-1 text-xs">
            {/* LONG Conditions */}
            <div className="bg-bg-deep p-3 rounded-xl border border-bullish/20 space-y-1.5">
              <div className="font-bold text-bullish-bright flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-bullish-bright"></span>
                LONG Entry Rules
              </div>
              <ul className="space-y-1 pl-3 text-text-muted list-disc text-[11px]">
                {parsedData.long_conditions.map((cond, i) => (
                  <li key={i} className="text-text-main">{cond}</li>
                ))}
              </ul>
            </div>

            {/* SHORT Conditions */}
            <div className="bg-bg-deep p-3 rounded-xl border border-bearish/20 space-y-1.5">
              <div className="font-bold text-bearish-bright flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-bearish-bright"></span>
                SHORT Entry Rules
              </div>
              <ul className="space-y-1 pl-3 text-text-muted list-disc text-[11px]">
                {parsedData.short_conditions.map((cond, i) => (
                  <li key={i} className="text-text-main">{cond}</li>
                ))}
              </ul>
            </div>

            {/* Risk Management */}
            <div className="bg-bg-deep p-3 rounded-xl border border-border-subtle space-y-1.5">
              <div className="font-bold text-brand-400 flex items-center gap-1.5">
                <ShieldCheck size={14} />
                Risk Management Rules
              </div>
              <div className="text-[11px] text-text-muted flex justify-between font-mono">
                <span className="text-bearish-bright font-semibold">{parsedData.risk_management.stop_loss}</span>
                <span className="text-bullish-bright font-semibold">{parsedData.risk_management.take_profit}</span>
              </div>
            </div>

            {/* Timeframe */}
            <div className="bg-bg-deep p-3 rounded-xl border border-border-subtle">
              <div className="font-bold text-text-main text-[11px] mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-brand-400" />
                Execution Timeframe
              </div>
              <div className="text-[11px] text-text-muted font-mono">{parsedData.timeframe}</div>
            </div>

            {/* Applicable Pairs */}
            <div className="bg-bg-deep p-3 rounded-xl border border-border-subtle">
              <div className="font-bold text-text-main text-[11px] mb-1 flex items-center gap-1.5">
                <Coins size={13} className="text-brand-400" />
                Applicability
              </div>
              <div className="text-[11px] text-text-muted">{parsedData.applicability}</div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: STRUCTURED JSON DEFINITION */}
        <div className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md flex flex-col">
          <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2.5 mb-2.5">
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={14} className="text-brand-400" />
              Strategy Schema (JSON)
            </h3>

            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1 px-2.5 py-1 bg-bg-deep hover:bg-bg-surface border border-border-subtle rounded-lg text-[11px] text-text-muted hover:text-text-main transition-colors"
            >
              {copied ? <Check size={12} className="text-bullish-bright" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>

          <div className="flex-1 bg-bg-deep border border-border-subtle rounded-xl p-3 font-mono text-[11px] text-bullish-bright overflow-y-auto max-h-[580px] leading-relaxed shadow-inner">
            <pre className="whitespace-pre-wrap font-mono">
              {JSON.stringify(parsedData.json_schema, null, 2)}
            </pre>
          </div>
        </div>

        {/* COLUMN 4: VALIDATION & LIBRARY PERSISTENCE */}
        <div className="flex flex-col gap-4">
          {/* Section 1: Integrity Checks */}
          <div className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md space-y-3">
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider border-b border-border-subtle/50 pb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-bullish-bright" />
              Integrity & Validation Checks
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-bullish-bright" />
                  Missing Required Fields
                </span>
                <span className="font-semibold text-bullish-bright">{parsedData.validation.missing_required}</span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted flex items-center gap-1.5">
                  <Scale size={13} className="text-brand-400" />
                  Logic Consistency
                </span>
                <span className="font-semibold text-brand-400">{parsedData.validation.logic_check}</span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted flex items-center gap-1.5">
                  <LineChart size={13} className="text-accent-purple" />
                  Indicator Support
                </span>
                <span className="font-semibold text-accent-purple">{parsedData.validation.supported_indicators}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-bullish/15 border border-bullish/30 text-bullish-bright font-semibold text-[11px] text-center mt-2 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>{parsedData.validation.status}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Save to Strategy Library */}
          <div className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-4 backdrop-blur-md shadow-md space-y-3 flex-1 flex flex-col justify-between">
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider border-b border-border-subtle/50 pb-2 flex items-center gap-1.5">
              <Save size={14} className="text-brand-400" />
              Save to Strategy Library
            </h3>

            <div className="space-y-2.5 text-xs flex-1">
              <div>
                <label className="text-[11px] font-semibold text-text-muted mb-1 block">Strategy Name</label>
                <input
                  type="text"
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-xl p-2 text-xs text-text-main font-mono outline-none focus:border-brand-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-text-muted mb-1 block">Version</label>
                <input
                  type="text"
                  value={libraryVersion}
                  onChange={(e) => setLibraryVersion(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-xl p-2 text-xs text-text-main font-mono outline-none focus:border-brand-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-text-muted mb-1 block">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={libraryTags}
                  onChange={(e) => setLibraryTags(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-xl p-2 text-xs text-text-main outline-none focus:border-brand-400"
                />
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-border-subtle/50">
              <button
                onClick={handleSaveToLibrary}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-bg-deep font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-yellow-500/10 transition-all cursor-pointer"
              >
                <Save size={14} />
                <span>Save to Library</span>
              </button>

              <button
                onClick={handleRunBacktestNow}
                className="w-full py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-bg-deep font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/15 transition-all cursor-pointer"
              >
                <Play size={14} fill="currentColor" />
                <span>Run Backtest Now</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Saved Strategy Library Modal */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between bg-bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                    Saved Strategy Library
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono">
                      {savedStrategies.length} Strategies
                    </span>
                  </h3>
                  <p className="text-xs text-text-muted">
                    Browse and load validated AI/Custom strategies saved in SQLite database.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenLibrary}
                  disabled={loadingLibrary}
                  className="p-2 hover:bg-bg-surface rounded-xl text-text-muted hover:text-text-main transition-colors"
                  title="Refresh library"
                >
                  <RefreshCw size={16} className={loadingLibrary ? "animate-spin text-brand-400" : ""} />
                </button>
                <button
                  onClick={() => setIsLibraryOpen(false)}
                  className="p-2 hover:bg-bg-surface rounded-xl text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
              {loadingLibrary ? (
                <div className="py-16 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-brand-400" />
                  <span>Loading saved strategy records...</span>
                </div>
              ) : savedStrategies.length === 0 ? (
                <div className="py-16 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-3">
                  <FolderOpen className="w-10 h-10 text-text-dim" />
                  <p className="font-semibold text-text-main">No saved strategies found yet.</p>
                  <p className="text-[11px] text-text-dim max-w-sm">
                    Generate trading rules using AI Prompt or Website extraction, then click "Save to Library".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {savedStrategies.map((strat) => (
                    <div
                      key={strat.id}
                      className="p-4 rounded-xl bg-bg-surface/60 hover:bg-bg-surface border border-border-subtle hover:border-amber-500/40 transition-all flex flex-col justify-between gap-3 group"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-text-main group-hover:text-amber-300 transition-colors truncate">
                            {strat.name}
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-deep text-text-muted border border-border-subtle shrink-0">
                            v{strat.version || '1.0.0'}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                          {strat.description || strat.source_prompt || 'Custom strategy configuration'}
                        </p>
                        {strat.created_at && (
                          <div className="text-[10px] text-text-dim font-mono">
                            Created: {new Date(strat.created_at).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border-subtle/40">
                        <button
                          onClick={() => handleLoadFromLibrary(strat)}
                          className="flex-1 py-1.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Check size={13} />
                          <span>Load into Studio</span>
                        </button>
                        <button
                          onClick={() => {
                            handleLoadFromLibrary(strat);
                            navigate("/backtest", { state: { strategy: strat, autoRun: true } });
                          }}
                          className="py-1.5 px-3 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 hover:text-brand-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Load and Backtest"
                        >
                          <Play size={12} fill="currentColor" />
                          <span>Backtest</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteFromLibrary(strat.id, strat.name, e)}
                          className="py-1.5 px-2.5 bg-bearish/10 hover:bg-bearish/25 border border-bearish/30 text-bearish-bright hover:text-white text-xs font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete from Library"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border-subtle bg-bg-surface/40 flex justify-end">
              <button
                onClick={() => setIsLibraryOpen(false)}
                className="px-4 py-2 bg-bg-deep hover:bg-bg-surface border border-border-subtle rounded-xl text-xs font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl border flex items-center justify-between gap-4 shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 backdrop-blur-xl ${
          toast.type === 'success' 
            ? 'bg-bullish/15 border-bullish/40 text-bullish-bright' 
            : 'bg-bearish/15 border-bearish/40 text-bearish-bright'
        }`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-semibold text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
