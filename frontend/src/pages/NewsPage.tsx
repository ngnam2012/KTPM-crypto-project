import React, { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, RefreshCw, Clock, Filter } from 'lucide-react';
import { SentimentSummary } from '../components/SentimentSummary';

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
      if (!res.ok) throw new Error("Failed to fetch news");
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
    const interval = setInterval(fetchNews, 60000); // auto refresh every 60s
    return () => clearInterval(interval);
  }, [selectedSource]);

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
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Newspaper className="text-blue-500 w-8 h-8" />
            Crypto News Feed
          </h1>
          <p className="text-slate-400 mt-1">Aggregated live updates from top crypto sources.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              className="w-full bg-slate-900 border border-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block pl-10 p-2.5 appearance-none cursor-pointer"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="all">All Sources</option>
              {sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={() => fetchNews()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* AI Sentiment Analysis Widget */}
      <SentimentSummary />

      {loading && news.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-48 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/4 mb-4"></div>
              <div className="h-6 bg-slate-800 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-slate-800 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-800 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map(item => (
            <a 
              key={item.id} 
              href={item.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:bg-slate-800/80 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-blue-400 rounded-md border border-slate-700 group-hover:bg-slate-700">
                  {item.source}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  {timeAgo(item.published_at)}
                </span>
              </div>
              
              <h2 className="text-lg font-bold text-slate-200 mb-3 line-clamp-2 group-hover:text-blue-400 transition-colors">
                {item.title}
              </h2>
              
              <div 
                className="text-sm text-slate-400 line-clamp-3 mb-4 flex-1"
                dangerouslySetInnerHTML={{ __html: item.content }}
              />
              
              <div className="mt-auto pt-4 border-t border-slate-800 flex justify-between items-center">
                {item.sentiment_label ? (
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                    item.sentiment_label === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                    item.sentiment_label === 'negative' ? 'bg-red-500/10 text-red-400' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {item.sentiment_label.toUpperCase()}
                  </span>
                ) : (
                  <span></span>
                )}
                
                <span className="text-xs text-blue-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  Read more <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </a>
          ))}
          
          {news.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
              <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No news articles found for this source.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
