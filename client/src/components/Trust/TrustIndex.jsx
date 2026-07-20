import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const TrustIndex = () => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ totalFlags: 0, topOffender: 'None' });
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    const { data, count } = await supabase
      .from('flagged_clauses')
      .select('company_name', { count: 'exact' });
    
    if (data) {
      const counts = data.reduce((acc, curr) => {
        acc[curr.company_name] = (acc[curr.company_name] || 0) + 1;
        return acc;
      }, {});
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      setStats({
        totalFlags: count || 0,
        topOffender: sorted[0] ? sorted[0][0] : 'None'
      });
      setLeaderboard(sorted.slice(0, 5));
    }
  };

  const handleUpvote = async (clauseId, currentUpvotes) => {
    const { error } = await supabase
      .from('flagged_clauses')
      .update({ upvotes: currentUpvotes + 1 })
      .eq('id', clauseId);
    
    if (!error) {
      setResults(results.map(r => r.id === clauseId ? { ...r, upvotes: r.upvotes + 1 } : r));
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search) return;

    const { data } = await supabase
      .from('flagged_clauses')
      .select('*')
      .ilike('company_name', `%${search}%`)
      .order('upvotes', { ascending: false });
    
    if (data) setResults(data);
  };

  return (
    <div className="mt-16 md:mt-24 bg-ink text-white p-6 md:p-12 relative overflow-hidden">
      <div className="absolute right-0 top-0 opacity-[0.03] font-sans text-[8rem] md:text-[15rem] leading-none pointer-events-none">TRUST</div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="section-label text-gold text-xs md:text-sm mb-4">Community Intelligence</div>
        <h3 className="font-sans text-3xl md:text-5xl font-black mb-8 md:mb-12 text-white">Search Before You <em>Sign.</em></h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mb-12 md:mb-20">
          <div className="lg:col-span-2">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-8 md:mb-12">
              <input 
                type="text"
                placeholder="Search Company Name (e.g. Acme Corp)"
                className="flex-grow bg-white/5 border border-white/20 p-4 font-sans text-sm focus:outline-none focus:border-gold transition-colors text-white w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn-primary w-full sm:w-auto text-center justify-center">Search Index</button>
            </form>

            {results.length > 0 && (
              <div className="space-y-6 animate-fade-up">
                <h4 className="font-sans font-bold text-[10px] uppercase tracking-[0.2em] text-gold mb-4 md:mb-8">Results for "{search}"</h4>
                {results.map(r => (
                  <div key={r.id} className="bg-white/5 p-4 md:p-6 border-l-4 border-red-700 hover:bg-white/10 transition-all">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-red-700 leading-tight">{r.risk_category}</div>
                      <button 
                        onClick={() => handleUpvote(r.id, r.upvotes)}
                        className="bg-red-700/20 text-red-700 text-[9px] px-3 py-2 sm:py-1 font-bold uppercase tracking-widest hover:bg-red-700 hover:text-white transition-all whitespace-nowrap w-full sm:w-auto text-center"
                      >
                        ▲ I've seen this ({r.upvotes})
                      </button>
                    </div>
                    <p className="text-xs italic text-white/80 leading-relaxed mb-4 break-words">"{r.clause_text}"</p>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/5 p-6 md:p-8 border border-white/10 h-fit">
            <h4 className="font-sans font-bold text-xs uppercase tracking-widest text-gold mb-6 md:mb-8 border-b border-white/10 pb-4">Ethics Leaderboard</h4>
            <div className="space-y-6 md:space-y-8">
              {leaderboard.map(([name, count], idx) => (
                <div key={name} className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                    <span className="text-[10px] font-sans text-white/40 flex-shrink-0">0{idx + 1}</span>
                    <span className="text-xs font-bold truncate max-w-[100px] md:max-w-[120px]" title={name}>{name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="hidden sm:block h-1 bg-red-700" style={{ width: `${Math.min((count / Math.max(stats.totalFlags, 1)) * 40, 40)}px` }}></div>
                    <span className="text-[10px] font-black text-red-700">{count} flags</span>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && <div className="text-[10px] text-white/40 italic">Waiting for community flags...</div>}
            </div>
            <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-white/10">
              <div className="text-[10px] text-white/40 leading-relaxed uppercase tracking-tighter">
                Global Database: <br className="md:hidden" />
                <span className="text-white">{stats.totalFlags} Predatory Terms</span> Flagged.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustIndex;

