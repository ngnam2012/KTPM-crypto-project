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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-64 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/3 mb-6"></div>
        <div className="h-4 bg-slate-800 rounded w-full mb-4"></div>
        <div className="h-4 bg-slate-800 rounded w-full mb-4"></div>
      </div>
    );
  }

  if (!data) return null;

  const getLabelColor = (label: string) => {
    if (label === 'POSITIVE') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (label === 'NEGATIVE') return 'text-red-400 bg-red-400/10 border-red-400/20';
    return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  };

  const getLabelIcon = (label: string) => {
    if (label === 'POSITIVE') return <TrendingUp className="w-3 h-3" />;
    if (label === 'NEGATIVE') return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  // Convert 0-1 score to an index for the gauge (0-100)
  const gaugePercent = Math.round(data.average_score * 100);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row gap-8">
      {/* Gauge and Distribution */}
      <div className="flex-1 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="text-purple-500 w-6 h-6" />
          Market Sentiment
        </h2>
        
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-slate-800">
            {/* Simple CSS gauge representation */}
            <div 
              className="absolute inset-0 rounded-full border-4 border-purple-500 border-l-transparent border-b-transparent"
              style={{ transform: `rotate(${gaugePercent * 3.6 - 135}deg)` }}
            ></div>
            <div className="text-center">
              <div className="text-2xl font-black text-white">{gaugePercent}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Score</div>
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-20 text-sm font-medium text-emerald-400">Positive</div>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.distribution.positive}%` }}></div>
              </div>
              <div className="w-10 text-right text-xs text-slate-400">{data.distribution.positive}%</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 text-sm font-medium text-slate-400">Neutral</div>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-slate-500 rounded-full" style={{ width: `${data.distribution.neutral}%` }}></div>
              </div>
              <div className="w-10 text-right text-xs text-slate-400">{data.distribution.neutral}%</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 text-sm font-medium text-red-400">Negative</div>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${data.distribution.negative}%` }}></div>
              </div>
              <div className="w-10 text-right text-xs text-slate-400">{data.distribution.negative}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Evaluated News */}
      <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-8">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Latest Analyzed Signals</h3>
        <div className="space-y-3">
          {data.recent_news.map(item => (
            <div key={item.id} className="flex gap-3 items-start p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
              <div className={`mt-0.5 px-2 py-1 rounded border flex items-center gap-1 text-[10px] font-bold ${getLabelColor(item.sentiment_label)}`}>
                {getLabelIcon(item.sentiment_label)}
                {Math.round(item.sentiment_score * 100)}
              </div>
              <div>
                <p className="text-sm text-slate-200 line-clamp-1 font-medium">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1">{item.source}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
