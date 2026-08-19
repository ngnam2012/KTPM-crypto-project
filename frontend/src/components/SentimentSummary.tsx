import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentData {
  average_score: number;
  distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  recent_news: Array<{
    id: string;
    title: string;
    source: string;
    sentiment_label: string;
    sentiment_score: number;
    published_at: string;
  }>;
}

export const SentimentSummary: React.FC = () => {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/sentiment/summary');
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error("Failed to fetch sentiment summary", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSentiment();
    const interval = setInterval(fetchSentiment, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-6 h-64 animate-pulse">
        <div className="h-5 bg-bg-surface rounded w-1/4 mb-6"></div>
        <div className="h-3 bg-bg-surface rounded w-full mb-3"></div>
        <div className="h-3 bg-bg-surface rounded w-full mb-3"></div>
      </div>
    );
  }

  if (!data) return null;

  const getLabelColor = (label: string) => {
    const l = label ? label.toUpperCase() : 'NEUTRAL';
    if (l === 'POSITIVE') return 'text-bullish-bright bg-bullish/15 border-bullish/30';
    if (l === 'NEGATIVE') return 'text-bearish-bright bg-bearish/15 border-bearish/30';
    return 'text-text-muted bg-bg-surface border-border-subtle';
  };

  const getLabelIcon = (label: string) => {
    const l = label ? label.toUpperCase() : 'NEUTRAL';
    if (l === 'POSITIVE') return <TrendingUp className="w-3 h-3" />;
    if (l === 'NEGATIVE') return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const gaugePercent = Math.round(data.average_score * 100);

  return (
    <div className="bg-bg-panel/80 border border-border-subtle rounded-2xl p-6 flex flex-col md:flex-row gap-8 shadow-lg">
      {/* Gauge and Distribution */}
      <div className="flex-1 space-y-6">
        <h2 className="text-lg font-bold flex items-center gap-2 text-text-main">
          <Activity className="text-accent-purple w-5 h-5" />
          FinBERT Real-Time Market Sentiment
        </h2>
        
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-bg-surface bg-bg-deep shadow-inner">
            <div 
              className="absolute inset-0 rounded-full border-4 border-accent-purple border-l-transparent border-b-transparent transition-transform duration-500"
              style={{ transform: `rotate(${gaugePercent * 3.6 - 135}deg)` }}
            ></div>
            <div className="text-center">
              <div className="text-2xl font-black text-text-main font-mono">{gaugePercent}</div>
              <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider font-mono">Score</div>
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 text-xs">
              <div className="w-20 font-semibold text-bullish-bright">Positive</div>
              <div className="flex-1 h-2 bg-bg-deep rounded-full overflow-hidden border border-border-subtle/50">
                <div className="h-full bg-bullish-bright rounded-full" style={{ width: `${data.distribution.positive}%` }}></div>
              </div>
              <div className="w-12 text-right font-mono text-text-muted">{data.distribution.positive}%</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-20 font-semibold text-text-muted">Neutral</div>
              <div className="flex-1 h-2 bg-bg-deep rounded-full overflow-hidden border border-border-subtle/50">
                <div className="h-full bg-slate-500 rounded-full" style={{ width: `${data.distribution.neutral}%` }}></div>
              </div>
              <div className="w-12 text-right font-mono text-text-muted">{data.distribution.neutral}%</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-20 font-semibold text-bearish-bright">Negative</div>
              <div className="flex-1 h-2 bg-bg-deep rounded-full overflow-hidden border border-border-subtle/50">
                <div className="h-full bg-bearish-bright rounded-full" style={{ width: `${data.distribution.negative}%` }}></div>
              </div>
              <div className="w-12 text-right font-mono text-text-muted">{data.distribution.negative}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Evaluated News */}
      <div className="flex-1 border-t md:border-t-0 md:border-l border-border-subtle pt-6 md:pt-0 md:pl-8">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Latest Evaluated Signals</h3>
        <div className="space-y-3">
          {data.recent_news.map(item => (
            <div key={item.id} className="flex gap-3 items-start p-2 rounded-xl hover:bg-bg-surface transition-colors">
              <div className={`mt-0.5 px-2 py-0.5 rounded-md border flex items-center gap-1 text-[10px] font-bold ${getLabelColor(item.sentiment_label)} font-mono`}>
                {getLabelIcon(item.sentiment_label)}
                {Math.round(item.sentiment_score * 100)}%
              </div>
              <div>
                <p className="text-xs text-text-main line-clamp-1 font-semibold">{item.title}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{item.source}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
