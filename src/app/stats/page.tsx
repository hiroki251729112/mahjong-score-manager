"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Member = { id: number; name: string };
type Match = { id: number; match_date: string };
type Game = { id: number; match_id: number; game_number: number };
type Result = { game_id: number; member_id: number; rank: number; final_score: number };
type Entry = { memberId: number; matchId: number; gameId: number; date: string; gameNumber: number; rank: number; score: number };
type Tab = "ranking" | "member" | "trend";
type Period = "all" | "year" | "30days";
type Unit = "game" | "match";

const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const scoreColor = (n: number) => n > 0 ? "text-green-600" : n < 0 ? "text-red-600" : "text-gray-500";
const dateLabel = (d: string) => d.replace(/-/g, "/").slice(5, 10);

function LineGraph({ values, labels }: { values: number[]; labels: string[] }) {
  if (!values.length) return <p className="py-12 text-center text-sm text-gray-500">この期間の成績がありません</p>;
  const width = 340, height = 205, left = 43, right = 12, top = 18, bottom = 34;
  const plotW = width - left - right, plotH = height - top - bottom;
  const low = Math.min(0, ...values), high = Math.max(0, ...values);
  const padding = Math.max(10, (high - low) * 0.12);
  const min = low - padding, max = high + padding;
  const x = (i: number) => left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
  const y = (v: number) => top + ((max - v) / (max - min)) * plotH;
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  const labelIndices = Array.from(new Set([0, Math.floor((values.length - 1) / 2), values.length - 1]));
  return <div className="w-full overflow-hidden">
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="累計スコア推移グラフ">
      {ticks.map((v, i) => <g key={i}><line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="#e5e7eb"/><text x={left - 5} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(v)}</text></g>)}
      <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#a78bfa" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="#7e22ce" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.length <= 35 && values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.7" fill="#7e22ce" />)}
      {labelIndices.map(i => <text key={i} x={x(i)} y={height - 11} textAnchor={i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"} fontSize="10" fill="#6b7280">{labels[i]}</text>)}
    </svg>
  </div>;
}

export default function StatsPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tab, setTab] = useState<Tab>("ranking");
  const [period, setPeriod] = useState<Period>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [unit, setUnit] = useState<Unit>("game");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) { router.replace("/login"); return; }
      const userId = auth.user.id;
      const [membersRes, matchesRes] = await Promise.all([
        supabase.from("members").select("id,name").eq("user_id", userId).order("id"),
        supabase.from("matches").select("id,match_date").eq("user_id", userId).order("match_date", { ascending: true }).order("id", { ascending: true }),
      ]);
      if (membersRes.error || matchesRes.error) { if (active) { setError("メンバーまたは対戦データを取得できませんでした"); setLoading(false); } return; }
      const memberRows = (membersRes.data ?? []) as Member[];
      const matches = (matchesRes.data ?? []) as Match[];
      if (!active) return;
      setMembers(memberRows);
      setSelectedId(prev => prev ?? memberRows[0]?.id ?? null);
      if (!matches.length) { setLoading(false); return; }
      const gamesRes = await supabase.from("games").select("id,match_id,game_number").in("match_id", matches.map(m => m.id)).order("game_number", { ascending: true });
      if (gamesRes.error) { if (active) { setError("半荘データを取得できませんでした"); setLoading(false); } return; }
      const games = (gamesRes.data ?? []) as Game[];
      if (!games.length) { if (active) setLoading(false); return; }
      const resultsRes = await supabase.from("game_results").select("game_id,member_id,rank,final_score").in("game_id", games.map(g => g.id));
      if (resultsRes.error) { if (active) { setError("スコアを取得できませんでした"); setLoading(false); } return; }
      const gameById = new Map(games.map(g => [g.id, g]));
      const matchById = new Map(matches.map(m => [m.id, m]));
      const validIds = new Set(memberRows.map(m => m.id));
      const rows: Entry[] = ((resultsRes.data ?? []) as Result[]).flatMap(r => {
        const g = gameById.get(r.game_id);
        const m = g && matchById.get(g.match_id);
        if (!g || !m || !validIds.has(r.member_id)) return [];
        return [{ memberId: r.member_id, matchId: g.match_id, gameId: g.id, date: m.match_date, gameNumber: g.game_number, rank: r.rank, score: Number(r.final_score) || 0 }];
      });
      rows.sort((a, b) => a.date.localeCompare(b.date) || a.matchId - b.matchId || a.gameNumber - b.gameNumber || a.gameId - b.gameId);
      if (active) { setEntries(rows); setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [router]);

  const filtered = useMemo(() => {
    const today = new Date();
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,"0")}-${String(cutoff.getDate()).padStart(2,"0")}`;
    return entries.filter(e => period === "all" || (period === "year" ? e.date.slice(0, 4) === String(today.getFullYear()) : e.date.slice(0, 10) >= cutoffStr));
  }, [entries, period]);

  const stats = useMemo(() => members.map(member => {
    const list = filtered.filter(e => e.memberId === member.id);
    const total = list.reduce((sum, e) => sum + e.score, 0);
    const counts = [1,2,3,4].map(rank => list.filter(e => e.rank === rank).length);
    return { ...member, total, games: list.length, average: list.length ? total / list.length : 0, averageRank: list.length ? list.reduce((s,e)=>s+e.rank,0)/list.length : 0, counts, max: list.length ? Math.max(...list.map(e=>e.score)) : 0, min: list.length ? Math.min(...list.map(e=>e.score)) : 0 };
  }), [members, filtered]);
  const ranked = useMemo(() => [...stats].sort((a,b) => b.total-a.total || b.games-a.games || a.id-b.id), [stats]);
  const current = stats.find(m => m.id === selectedId);
  const memberEntries = filtered.filter(e => e.memberId === selectedId);
  const trend = useMemo(() => {
    const list = filtered.filter(e => e.memberId === selectedId);
    const grouped: { key: string; label: string; score: number }[] = [];
    for (const e of list) {
      const key = unit === "game" ? `${e.gameId}` : `${e.matchId}`;
      const prev = grouped[grouped.length - 1];
      if (prev && prev.key === key) prev.score += e.score;
      else grouped.push({ key, label: unit === "game" ? `${grouped.length + 1}半荘` : dateLabel(e.date), score: e.score });
    }
    let cumulative = 0;
    return { values: grouped.map(g => cumulative += g.score), labels: grouped.map(g => g.label), count: grouped.length };
  }, [filtered, selectedId, unit]);

  const tabs: { id: Tab; label: string }[] = [{ id: "ranking", label: "ランキング" }, { id: "member", label: "メンバー別" }, { id: "trend", label: "スコア推移" }];
  return <main className="min-h-screen bg-gray-100 px-4 py-5 text-gray-900">
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3"><Link href="/" className="rounded-lg bg-white px-3 py-2 text-xl shadow-sm" aria-label="ホームに戻る">‹</Link><h1 className="text-2xl font-bold">成績詳細</h1></div>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-purple-100 p-1">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-1 py-3 text-sm font-bold transition ${tab === t.id ? "bg-purple-700 text-white shadow" : "text-purple-800"}`}>{t.label}</button>)}
      </div>
      <div className="mb-4 flex items-center justify-between gap-2"><span className="text-sm font-semibold text-gray-600">集計期間</span><select aria-label="集計期間" value={period} onChange={e=>setPeriod(e.target.value as Period)} className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm"><option value="all">全期間</option><option value="year">今年</option><option value="30days">直近30日</option></select></div>
      {loading ? <p className="py-16 text-center text-gray-500">読み込み中...</p> : error ? <div className="rounded-xl bg-white p-5 text-red-600">{error}</div> : <>
        {tab === "ranking" && <section className="space-y-3">
          <p className="text-sm text-gray-500">通算スコア順に表示しています。メンバーを押すと詳細を確認できます。</p>
          {ranked.length === 0 ? <div className="rounded-xl bg-white p-5 text-gray-500">メンバーが登録されていません</div> : ranked.map((m,i)=><button key={m.id} onClick={()=>{setSelectedId(m.id);setTab("member");}} className="flex w-full items-center gap-3 rounded-xl border border-purple-100 bg-white p-4 text-left shadow-sm">
            <span className="w-10 shrink-0 text-center text-lg font-bold text-purple-700">{i+1}位</span><div className="min-w-0 flex-1"><p className="break-words font-bold">{m.name}</p><p className="text-xs text-gray-500">{m.games}半荘 · 平均順位 {m.games ? m.averageRank.toFixed(2) : "—"}位</p></div><span className={`shrink-0 text-xl font-bold ${scoreColor(m.total)}`}>{signed(m.total)}</span>
          </button>)}
        </section>}
        {(tab === "member" || tab === "trend") && <div className="mb-4 rounded-xl bg-white p-4 shadow-sm"><label htmlFor="member-select" className="mb-2 block text-sm font-bold text-gray-600">メンバーを選択</label><select id="member-select" className="w-full rounded-lg border border-purple-200 bg-white p-3" value={selectedId ?? ""} onChange={e=>setSelectedId(Number(e.target.value))}>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>}
        {tab === "member" && current && <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">{[
            { label: "通算スコア", value: signed(current.total), color: scoreColor(current.total) },
            { label: "平均スコア / 半荘", value: current.games ? signed(current.average,1) : "—", color: scoreColor(current.average) },
            { label: "半荘数", value: `${current.games}半荘`, color: "text-gray-900" },
            { label: "平均順位", value: current.games ? `${current.averageRank.toFixed(2)}位` : "—", color: "text-gray-900" },
            { label: "1位率", value: current.games ? `${(current.counts[0]/current.games*100).toFixed(1)}%` : "—", color: "text-gray-900" },
            { label: "4位率", value: current.games ? `${(current.counts[3]/current.games*100).toFixed(1)}%` : "—", color: "text-gray-900" },
            { label: "最高スコア / 半荘", value: current.games ? signed(current.max) : "—", color: scoreColor(current.max) },
            { label: "最低スコア / 半荘", value: current.games ? signed(current.min) : "—", color: scoreColor(current.min) },
          ].map(s=><div key={s.label} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-500">{s.label}</p><p className={`mt-2 break-all text-2xl font-bold ${s.color}`}>{s.value}</p></div>)}</div>
          <div className="rounded-xl bg-white p-4 shadow-sm"><h2 className="mb-4 font-bold">順位分布</h2>{current.counts.map((count,i)=><div key={i} className="mb-3 flex items-center gap-3"><span className="w-8 text-sm">{i+1}位</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-purple-100"><div className="h-full rounded-full bg-purple-600" style={{width:`${current.games ? count/current.games*100 : 0}%`}} /></div><span className="w-20 text-right text-xs text-gray-600">{count}回 ({current.games ? (count/current.games*100).toFixed(0) : 0}%)</span></div>)}</div>
          <button className="w-full rounded-xl bg-purple-700 p-3 font-bold text-white" onClick={()=>setTab("trend")}>このメンバーのスコア推移を見る ›</button>
        </section>}
        {tab === "trend" && <section className="space-y-4"><div className="rounded-xl bg-white p-4 shadow-sm"><div className="mb-4 flex rounded-lg bg-purple-100 p-1"><button onClick={()=>setUnit("game")} className={`flex-1 rounded-md py-2 text-sm font-bold ${unit === "game" ? "bg-purple-700 text-white" : "text-purple-800"}`}>半荘ごと</button><button onClick={()=>setUnit("match")} className={`flex-1 rounded-md py-2 text-sm font-bold ${unit === "match" ? "bg-purple-700 text-white" : "text-purple-800"}`}>対戦ごと</button></div><h2 className="mb-1 font-bold">累計スコアの推移</h2><p className="mb-2 text-xs text-gray-500">{unit === "game" ? "1半荘ごと" : "1回の対戦ごと"}に合計して表示 · {trend.count}件</p><LineGraph values={trend.values} labels={trend.labels}/><p className="mt-2 text-center text-xs text-gray-500">横軸：{unit === "game" ? "半荘の順番" : "対戦日"}　縦軸：累計スコア</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">現在の累計スコア</p><p className={`mt-1 text-3xl font-bold ${scoreColor(current?.total ?? 0)}`}>{signed(current?.total ?? 0)}</p></div></section>}
        {members.length === 0 && tab !== "ranking" && <p className="text-center text-gray-500">メンバーが登録されていません</p>}
      </>}
    </div>
  </main>;
}
