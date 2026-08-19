import React, { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, RefreshCw, Clock, Filter } from 'lucide-react';
import { SentimentSummary } from '../components/SentimentSummary';
import { getDeviceTimezoneOffset, formatLocalDateTime } from '../shared/lib/timezone';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string;
  published_at: string;
  sentiment_score?: number;
  sentiment_label?: string;
}

export const NewsPage: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/news/sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch (err) {
      console.error("Failed to fetch sources", err);
    }
  };

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/news?limit=20&source=${selectedSource}`);
      if (!res.ok) throw new Error("Failed to fetch news feed");
      const data = await res.json();
      setNews(data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, [selectedSource]);

  const formatLocalTime = (dateStr: string) => {
    if (!dateStr) return '';
    return `${formatLocalDateTime(dateStr)} (${getDeviceTimezoneOffset()})`;
  };

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 text-text-main">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Newspaper className="text-accent-blue w-7 h-7" />
            Crypto News & Sentiment Feed
          </h1>
          <p className="text-xs text-text-muted mt-1">Aggregated live feeds analyzed with FinBERT Financial NLP model.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <select 
              className="w-full bg-bg-surface border border-border-subtle text-xs text-text-main rounded-xl focus:border-accent-blue block pl-9 p-2.5 outline-none cursor-pointer"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="all">All News Sources</option>
              {sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={() => fetchNews()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg-surface hover:bg-bg-hover rounded-xl transition-colors border border-border-subtle text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-bearish/10 border border-bearish/30 text-bearish-bright p-4 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* AI Sentiment Analysis Widget */}
      <SentimentSummary />

      {loading && news.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-bg-panel/60 border border-border-subtle rounded-2xl p-5 h-48 animate-pulse">
              <div className="h-4 bg-bg-surface rounded w-1/4 mb-4"></div>
              <div className="h-5 bg-bg-surface rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-bg-surface rounded w-full mb-2"></div>
              <div className="h-3 bg-bg-surface rounded w-5/6"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {news.map(item => (
            <a 
              key={item.id} 
              href={item.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-bg-panel/70 border border-border-subtle rounded-2xl p-5 hover:bg-bg-panel transition-all hover:-translate-y-1 hover:shadow-xl hover:border-accent-blue/30 group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 bg-bg-surface text-accent-blue rounded-lg border border-border-subtle">
                  {item.source}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-text-muted" title={formatLocalTime(item.published_at)}>
                  <Clock className="w-3 h-3" />
                  {timeAgo(item.published_at)}
                </span>
              </div>
              
              <h2 className="text-sm font-bold text-text-main mb-2.5 line-clamp-2 group-hover:text-accent-blue transition-colors">
                {item.title}
              </h2>
              
              <div 
                className="text-xs text-text-muted line-clamp-3 mb-4 flex-1 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: item.content }}
              />
              
              <div className="mt-auto pt-3 border-t border-border-subtle/50 flex justify-between items-center text-xs">
                {item.sentiment_label ? (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    item.sentiment_label.toUpperCase() === 'POSITIVE' ? 'bg-bullish/15 text-bullish-bright border border-bullish/30' :
                    item.sentiment_label.toUpperCase() === 'NEGATIVE' ? 'bg-bearish/15 text-bearish-bright border border-bearish/30' :
                    'bg-bg-surface text-text-muted border border-border-subtle'
                  }`}>
                    {item.sentiment_label.toUpperCase()} ({item.sentiment_score ? Math.round(item.sentiment_score * 100) : 50}%)
                  </span>
                ) : (
                  <span></span>
                )}
                
                <span className="text-[11px] text-accent-blue flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                  Read article <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </a>
          ))}
          
          {news.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-text-muted bg-bg-panel/50 rounded-2xl border border-border-subtle border-dashed">
              <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-xs">No news articles found for this source.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
