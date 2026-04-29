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
    <div className="mt-24 bg-ink text-paper p-12 relative overflow-hidden">
      <div className="absolute right-0 top-0 opacity-[0.03] font-playfair text-[15rem] leading-none pointer-events-none">TRUST</div>
      
      <div className="max-w-6xl mx-auto">
        <div className="section-label text-gold">Community Intelligence</div>
        <h3 className="font-playfair text-5xl font-black mb-12 text-paper">Search Before You <em>Sign.</em></h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-20">
          <div className="lg:col-span-2">
            <form onSubmit={handleSearch} className="flex gap-4 mb-12">
              <input 
                type="text"
                placeholder="Search Company Name (e.g. Acme Corp)"
                className="flex-grow bg-white/5 border border-white/20 p-4 font-mono text-sm focus:outline-none focus:border-gold transition-colors text-paper"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn-primary">Search Index</button>
            </form>

            {results.length > 0 && (
              <div className="space-y-6 animate-fade-up">
                <h4 className="font-syne font-bold text-[10px] uppercase tracking-[0.2em] text-gold mb-8">Results for "{search}"</h4>
                {results.map(r => (
                  <div key={r.id} className="bg-white/5 p-6 border-l-4 border-rust hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-rust">{r.risk_category}</div>
                      <button 
                        onClick={() => handleUpvote(r.id, r.upvotes)}
                        className="bg-rust/20 text-rust text-[9px] px-3 py-1 font-bold uppercase tracking-widest hover:bg-rust hover:text-white transition-all"
                      >
                        ▲ I've seen this ({r.upvotes})
                      </button>
                    </div>
                    <p className="text-xs italic text-paper/80 leading-relaxed mb-4">"{r.clause_text}"</p>
                    <div className="text-[10px] text-paper/30 uppercase tracking-widest">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/5 p-8 border border-white/10 h-fit">
            <h4 className="font-syne font-bold text-xs uppercase tracking-widest text-gold mb-8 border-b border-white/10 pb-4">Ethics Leaderboard</h4>
            <div className="space-y-8">
              {leaderboard.map(([name, count], idx) => (
                <div key={name} className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono text-paper/40">0{idx + 1}</span>
                    <span className="text-xs font-bold truncate max-w-[120px]">{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 bg-rust" style={{ width: `${(count / stats.totalFlags) * 40}px` }}></div>
                    <span className="text-[10px] font-black text-rust">{count} flags</span>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && <div className="text-[10px] text-paper/40 italic">Waiting for community flags...</div>}
            </div>
            <div className="mt-12 pt-8 border-t border-white/10">
              <div className="text-[10px] text-paper/40 leading-relaxed uppercase tracking-tighter">
                Global Database: <span className="text-paper">{stats.totalFlags} Predatory Terms</span> Flagged by ClearSight Community.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustIndex;
