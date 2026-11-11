"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Member = { id: number; name: string };
type Match = { id: number; match_date: string; rate: string | null; tip: string | null };
type Game = { id: number; match_id: number; game_number: number };
type Result = { game_id: number; member_id: number; rank: number; final_score: number; raw_score: number | null; chip: number | null };
type Entry = { memberId: number; matchId: number; gameId: number; date: string; gameNumber: number; rank: number; score: number; rawScore: number | null; scoreMoney: number; chipMoney: number };
type Tab = "ranking" | "member" | "trend";
type Period = "all" | "year" | "30days";
type Unit = "game" | "match";

const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const scoreColor = (n: number) => n > 0 ? "text-green-600" : n < 0 ? "text-red-600" : "text-gray-500";
const dateLabel = (d: string) => d.replace(/-/g, "/").slice(5, 10);
// Keep the conversion consistent with the existing match settlement screen.
const rateToYen = (rate: string | null) => {
  const presets: Record<string, number> = {
    "なし": 0, "テンイチ": 10, "テンニ": 20, "テンサン": 30,
    "テンヨン": 40, "テンゴ": 50, "テンピン": 100,
  };
  if (rate == null) return 0;
  if (Object.prototype.hasOwnProperty.call(presets, rate)) return presets[rate];
  const custom = Number(rate);
  return Number.isFinite(custom) && custom >= 0 ? custom : 0;
};
const tipToYen = (tip: string | null) => {
  if (!tip || tip === "なし") return 0;
  const amount = Number(tip);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};
const yen = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("ja-JP")}円`;

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


function Distribution({ scores }: { scores: number[] }) {
  const bins = [
    { label: "-60未満", test: (n: number) => n < -60 },
    { label: "-60〜-30", test: (n: number) => n >= -60 && n < -30 },
    { label: "-30〜0", test: (n: number) => n >= -30 && n < 0 },
    { label: "0〜+30", test: (n: number) => n >= 0 && n < 30 },
    { label: "+30〜+60", test: (n: number) => n >= 30 && n < 60 },
    { label: "+60以上", test: (n: number) => n >= 60 },
  ];
  const counts = bins.map(b => scores.filter(b.test).length);
  const max = Math.max(1, ...counts);
  const chartHeight = 160;
  return <div className="rounded-xl bg-white p-4 shadow-sm">
    <h2 className="font-bold">スコア分布</h2>
    <p className="mt-1 mb-4 text-xs text-gray-500">半荘の最終スコアを範囲別に集計（{scores.length}半荘）。棒が高いほど、そのスコア帯の半荘が多いことを示します。</p>
    {scores.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">この期間の成績がありません</p> : <div>
      <div className="flex items-end gap-1">
        <div className="flex w-7 shrink-0 flex-col justify-between text-right text-[10px] text-gray-500" style={{height:chartHeight}}><span>{max}回</span><span>{Math.round(max/2)}</span><span>0</span></div>
        <div className="flex min-w-0 flex-1 items-end gap-1 border-b border-gray-300" style={{height:chartHeight}}>
          {bins.map((b,i)=><div key={b.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] font-semibold tabular-nums text-purple-800">{counts[i]}</span>
            <div className="w-full max-w-12 rounded-t bg-purple-600" style={{height:`${counts[i] / max * (chartHeight - 22)}px`}} />
          </div>)}
        </div>
      </div>
      <div className="mt-2 flex gap-1"><div className="w-7 shrink-0" />{bins.map(b=><span key={b.label} className="min-w-0 flex-1 text-center text-[9px] leading-tight text-gray-600 break-words">{b.label}</span>)}</div>
      <p className="mt-3 text-center text-xs text-gray-500">縦軸：半荘数　横軸：最終スコア帯</p>
    </div>}
  </div>;
}

function MovingAverageGraph({ scores, windowSize }: { scores: number[]; windowSize: number }) {
  const averages = scores.map((_, i) => i + 1 < windowSize ? null : scores.slice(i + 1 - windowSize, i + 1).reduce((a,b) => a+b, 0) / windowSize);
  const valid = averages.filter((v): v is number => v !== null);
  if (!valid.length) return <p className="py-8 text-center text-sm text-gray-500">移動平均には{windowSize}半荘以上の記録が必要です（現在{scores.length}半荘）</p>;
  const width = 340, height = 200, left = 43, right = 12, top = 18, bottom = 30;
  const lo = Math.min(0, ...valid), hi = Math.max(0, ...valid);
  const pad = Math.max(5, (hi - lo) * 0.12), min = lo-pad, max = hi+pad;
  const x = (i: number) => left + (valid.length === 1 ? (width-left-right)/2 : i/(valid.length-1)*(width-left-right));
  const y = (v: number) => top + (max-v)/(max-min)*(height-top-bottom);
  const path = valid.map((v,i)=>`${i===0?'M':'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  return <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${windowSize}半荘移動平均グラフ`}>
    {[min,0,max].map((v,i)=><g key={i}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke={v===0?'#a78bfa':'#e5e7eb'} strokeDasharray={v===0?'4 4':undefined}/><text x={left-5} y={y(v)+4} textAnchor="end" fontSize="10" fill="#6b7280">{v.toFixed(0)}</text></g>)}
    <path d={path} stroke="#7e22ce" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
    <text x={left} y={height-8} fontSize="10" fill="#6b7280">{windowSize}半荘目</text>
    <text x={width-right} y={height-8} textAnchor="end" fontSize="10" fill="#6b7280">{scores.length}半荘目</text>
  </svg>;
}

export default function StatsPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tab, setTab] = useState<Tab>("ranking");
  const [period, setPeriod] = useState<Period>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [unit, setUnit] = useState<Unit>("game");
  const [averageWindow, setAverageWindow] = useState<5 | 10>(5);
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
        supabase.from("matches").select("id,match_date,rate,tip").eq("user_id", userId).order("match_date", { ascending: true }).order("id", { ascending: true }),
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
      const resultsRes = await supabase.from("game_results").select("game_id,member_id,rank,final_score,raw_score,chip").in("game_id", games.map(g => g.id));
      if (resultsRes.error) { if (active) { setError("スコアを取得できませんでした"); setLoading(false); } return; }
      const gameById = new Map(games.map(g => [g.id, g]));
      const matchById = new Map(matches.map(m => [m.id, m]));
      const validIds = new Set(memberRows.map(m => m.id));
      const rows: Entry[] = ((resultsRes.data ?? []) as Result[]).flatMap(r => {
        const g = gameById.get(r.game_id);
        const m = g && matchById.get(g.match_id);
        if (!g || !m || !validIds.has(r.member_id)) return [];
        return [{ memberId: r.member_id, matchId: g.match_id, gameId: g.id, date: m.match_date, gameNumber: g.game_number, rank: r.rank, score: Number(r.final_score) || 0, rawScore: r.raw_score == null ? null : Number(r.raw_score), scoreMoney: (Number(r.final_score) || 0) * rateToYen(m.rate), chipMoney: (Number(r.chip) || 0) * tipToYen(m.tip) }];
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
    const totalScoreMoney = list.reduce((sum, e) => sum + e.scoreMoney + e.chipMoney, 0);
    const counts = [1,2,3,4].map(rank => list.filter(e => e.rank === rank).length);
    return { ...member, total, totalScoreMoney, games: list.length, average: list.length ? total / list.length : 0, averageRank: list.length ? list.reduce((s,e)=>s+e.rank,0)/list.length : 0, counts, max: list.length ? Math.max(...list.map(e=>e.score)) : 0, min: list.length ? Math.min(...list.map(e=>e.score)) : 0, maxRaw: list.some(e=>e.rawScore !== null) ? Math.max(...list.filter(e=>e.rawScore !== null).map(e=>e.rawScore as number)) : null, minRaw: list.some(e=>e.rawScore !== null) ? Math.min(...list.filter(e=>e.rawScore !== null).map(e=>e.rawScore as number)) : null };
  }), [members, filtered]);
  const ranked = useMemo(() => [...stats].sort((a,b) => b.total-a.total || b.games-a.games || a.id-b.id), [stats]);
  const current = stats.find(m => m.id === selectedId);
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

  const selectedGames = useMemo(() => filtered.filter(e => e.memberId === selectedId), [filtered, selectedId]);
  const affinities = useMemo(() => {
    const byGame = new Map<number, Entry[]>();
    for (const e of filtered) {
      const group = byGame.get(e.gameId) ?? [];
      group.push(e);
      byGame.set(e.gameId, group);
    }
    return members.filter(m => m.id !== selectedId).map(m => {
      const together = selectedGames.filter(e => byGame.get(e.gameId)?.some(other => other.memberId === m.id));
      return { ...m, count: together.length, avgRank: together.length ? together.reduce((a,e)=>a+e.rank,0)/together.length : 0, avgScore: together.length ? together.reduce((a,e)=>a+e.score,0)/together.length : 0 };
    }).filter(m=>m.count>0).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name,'ja'));
  }, [filtered, members, selectedGames, selectedId]);
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
            { label: "スコア・チップ収支", value: yen(current.totalScoreMoney), color: scoreColor(current.totalScoreMoney) },
            { label: "平均スコア / 半荘", value: current.games ? signed(current.average,1) : "—", color: scoreColor(current.average) },
            { label: "半荘数", value: `${current.games}半荘`, color: "text-gray-900" },
            { label: "平均順位", value: current.games ? `${current.averageRank.toFixed(2)}位` : "—", color: "text-gray-900" },
            { label: "ラス回避率", value: current.games ? `${((current.games-current.counts[3])/current.games).toFixed(3)}` : "—", color: "text-green-700" },
          ].map(s=><div key={s.label} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-500">{s.label}</p><p className={`mt-2 break-all text-2xl font-bold ${s.color}`}>{s.value}</p></div>)}</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "最高記録", score: current.max, raw: current.maxRaw, color: scoreColor(current.max) },
              { label: "最低記録", score: current.min, raw: current.minRaw, color: scoreColor(current.min) },
            ].map(record => <div key={record.label} className="min-w-0 rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-800">{record.label}</h2>
              <p className="text-xs text-gray-500">スコア</p>
              <p className={`mt-1 break-all text-xl font-bold ${record.color}`}>{current.games ? signed(record.score) : "—"}</p>
              <p className="mt-3 text-xs text-gray-500">素点</p>
              <p className="mt-1 break-all text-lg font-bold text-gray-900">{record.raw === null ? "—" : `${record.raw.toLocaleString("ja-JP")}点`}</p>
            </div>)}
          </div>
          <p className="text-xs text-gray-500">※ スコアと素点の最高・最低は、それぞれ独立して集計しています。</p>
          <p className="text-xs text-gray-500">※ 対戦ごとのレート・チップ単価で計算。場代・追加支出は含みません。</p>
          <div className="rounded-xl bg-white p-4 shadow-sm"><h2 className="mb-4 font-bold">順位分布</h2>{current.counts.map((count,i)=><div key={i} className="mb-3 flex items-center gap-3"><span className="w-8 text-sm">{i+1}位</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-purple-100"><div className="h-full rounded-full bg-purple-600" style={{width:`${current.games ? count/current.games*100 : 0}%`}} /></div><span className="w-20 text-right text-xs text-gray-600">{count}回 ({current.games ? (count/current.games*100).toFixed(0) : 0}%)</span></div>)}</div>
          <Distribution scores={selectedGames.map(e => e.score)} />
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="font-bold">同卓相手との相性</h2>
            <p className="mt-1 mb-3 text-xs text-gray-500">その相手と同じ半荘に参加したときの自分の成績。相手との直接対決の勝率ではありません。</p>
            {affinities.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">この期間に同卓記録がありません</p> : <div className="space-y-2">{affinities.map(a=><div key={a.id} className="rounded-lg border border-purple-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-1"><span className="break-words font-bold">{a.name}</span><span className="text-xs text-gray-500">同卓 {a.count}半荘</span></div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm"><div>平均順位 <strong>{a.avgRank.toFixed(2)}位</strong></div><div>平均スコア <strong className={scoreColor(a.avgScore)}>{signed(a.avgScore,1)}</strong></div></div>
              {a.count < 5 && <p className="mt-1 text-xs text-amber-700">※ 5半荘未満のため参考値</p>}
            </div>)}</div>}
          </div>
          <button className="w-full rounded-xl bg-purple-700 p-3 font-bold text-white" onClick={()=>setTab("trend")}>このメンバーのスコア推移を見る ›</button>
        </section>}
        {tab === "trend" && <section className="space-y-4"><div className="rounded-xl bg-white p-4 shadow-sm"><div className="mb-4 flex rounded-lg bg-purple-100 p-1"><button onClick={()=>setUnit("game")} className={`flex-1 rounded-md py-2 text-sm font-bold ${unit === "game" ? "bg-purple-700 text-white" : "text-purple-800"}`}>半荘ごと</button><button onClick={()=>setUnit("match")} className={`flex-1 rounded-md py-2 text-sm font-bold ${unit === "match" ? "bg-purple-700 text-white" : "text-purple-800"}`}>対戦ごと</button></div><h2 className="mb-1 font-bold">累計スコアの推移</h2><p className="mb-2 text-xs text-gray-500">{unit === "game" ? "1半荘ごと" : "1回の対戦ごと"}に合計して表示 · {trend.count}件</p><LineGraph values={trend.values} labels={trend.labels}/><p className="mt-2 text-center text-xs text-gray-500">横軸：{unit === "game" ? "半荘の順番" : "対戦日"}　縦軸：累計スコア</p></div><div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">移動平均スコア</h2>
          <p className="mt-1 mb-3 text-xs text-gray-500">直近の5半荘または10半荘の平均スコアを、1半荘進むごとに計算したグラフです。上向きなら最近の成績が改善傾向、下向きなら低下傾向にあることが分かります。短期的な大勝ち・大負けの影響をならして調子を確認できます。期間内の記録だけで計算します。</p>
          <div className="mb-3 flex rounded-lg bg-purple-100 p-1">{([5,10] as const).map(n=><button key={n} onClick={()=>setAverageWindow(n)} className={`flex-1 rounded-md py-2 text-sm font-bold ${averageWindow===n?'bg-purple-700 text-white':'text-purple-800'}`}>直近{n}半荘</button>)}</div>
          <MovingAverageGraph scores={selectedGames.map(e=>e.score)} windowSize={averageWindow}/>
          <p className="mt-2 text-center text-xs text-gray-500">縦軸：平均スコア　横軸：半荘の順番</p>
        </div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">現在の累計スコア</p><p className={`mt-1 text-3xl font-bold ${scoreColor(current?.total ?? 0)}`}>{signed(current?.total ?? 0)}</p></div></section>}
        {members.length === 0 && tab !== "ranking" && <p className="text-center text-gray-500">メンバーが登録されていません</p>}
      </>}
    </div>
  </main>;
}
