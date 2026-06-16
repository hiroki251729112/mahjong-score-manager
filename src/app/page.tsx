"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MatchRow = {
  id: number;
  name: string;
  match_date: string;
  player_count: number;
};

type Member = {
  id: number;
  name: string;
  color: string;
};

type MatchPlayerRow = {
  match_id: number;
  member_id: number;
  seat_order: number;
};

type GameRow = {
  id: number;
  match_id: number;
};

type GameResultRow = {
  game_id: number;
  member_id: number;
  rank: number;
  final_score: number;
};

type MatchWithPlayers = MatchRow & {
  players: Member[];
  gameCount: number;
};

export default function Home() {
  const router = useRouter();

  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [gameRows, setGameRows] = useState<GameRow[]>([]);
  const [gameResultRows, setGameResultRows] = useState<GameResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

    return `${date.getFullYear()}年${
      date.getMonth() + 1
    }月${date.getDate()}日（${weekdays[date.getDay()]}）`;
  };

  const formatScore = (score: number) => {
    if (score > 0) return `+${score}`;
    return `${score}`;
  };

  const getMatchGameIds = (matchId: number) => {
    return gameRows
      .filter((game) => game.match_id === matchId)
      .map((game) => game.id);
  };

  const getTotalScore = (matchId: number, memberId: number) => {
    const gameIds = getMatchGameIds(matchId);

    return gameResultRows.reduce((total, result) => {
      if (!gameIds.includes(result.game_id)) return total;
      if (result.member_id !== memberId) return total;

      return total + (result.final_score ?? 0);
    }, 0);
  };

  const getRankCounts = (matchId: number, memberId: number) => {
    const gameIds = getMatchGameIds(matchId);
    const counts: Record<number, number> = {};

    gameResultRows.forEach((result) => {
      if (!gameIds.includes(result.game_id)) return;
      if (result.member_id !== memberId) return;

      counts[result.rank] = (counts[result.rank] ?? 0) + 1;
    });

    return counts;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("ログアウトに失敗しました");
      console.error(error);
      return;
    }

    router.push("/login");
  };

  useEffect(() => {
    const fetchMatches = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .order("match_date", { ascending: false })
        .order("id", { ascending: false });

      if (matchError) {
        alert("対戦一覧の取得に失敗しました");
        console.error(matchError);
        setLoading(false);
        return;
      }

      const { data: playerData, error: playerError } = await supabase
        .from("match_players")
        .select("*")
        .order("seat_order", { ascending: true });

      if (playerError) {
        alert("参加メンバーの取得に失敗しました");
        console.error(playerError);
        setLoading(false);
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*");

      if (memberError) {
        alert("メンバー情報の取得に失敗しました");
        console.error(memberError);
        setLoading(false);
        return;
      }

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id, match_id");

      if (gameError) {
        alert("対局情報の取得に失敗しました");
        console.error(gameError);
        setLoading(false);
        return;
      }

      const gameIds = ((gameData ?? []) as GameRow[]).map((game) => game.id);

      let resultRows: GameResultRow[] = [];

      if (gameIds.length > 0) {
        const { data: resultData, error: resultError } = await supabase
          .from("game_results")
          .select("game_id, member_id, rank, final_score")
          .in("game_id", gameIds);

        if (resultError) {
          alert("対局結果の取得に失敗しました");
          console.error(resultError);
          setLoading(false);
          return;
        }

        resultRows = (resultData ?? []) as GameResultRow[];
      }

      const matchRows = (matchData ?? []) as MatchRow[];
      const playerRows = (playerData ?? []) as MatchPlayerRow[];
      const memberRows = (memberData ?? []) as Member[];
      const games = (gameData ?? []) as GameRow[];

      const matchesWithPlayers = matchRows.map((match) => {
        const players = playerRows
          .filter((player) => player.match_id === match.id)
          .sort((a, b) => a.seat_order - b.seat_order)
          .map((player) =>
            memberRows.find((member) => member.id === player.member_id)
          )
          .filter(Boolean) as Member[];

        const gameCount = games.filter((game) => game.match_id === match.id)
          .length;

        return {
          ...match,
          players,
          gameCount,
        };
      });

      setGameRows(games);
      setGameResultRows(resultRows);
      setMatches(matchesWithPlayers);
      setLoading(false);
    };

    fetchMatches();
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">麻雀成績管理</h1>

        <details className="relative">
          <summary className="cursor-pointer list-none text-4xl">☰</summary>

          <div className="absolute right-0 z-10 mt-2 w-48 rounded-xl bg-white shadow-lg">
            <Link
              href="/members"
              className="block border-b p-3 hover:bg-gray-100"
            >
              メンバー管理
            </Link>

            <button
              onClick={logout}
              className="w-full p-3 text-left hover:bg-gray-100"
            >
              ログアウト
            </button>
          </div>
        </details>
      </div>

      <Link href="/create-match">
        <button className="mb-6 w-full rounded-xl bg-purple-700 py-3 font-bold text-white shadow-md">
          ＋ 新規対戦を作成
        </button>
      </Link>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : matches.length === 0 ? (
        <div className="rounded-xl bg-white p-4 text-gray-500 shadow">
          対戦履歴がありません
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <Link key={match.id} href={`/matches/${match.id}`}>
              <div className="rounded-2xl border border-purple-300 bg-white p-4 shadow-md transition hover:border-purple-600 hover:shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-xl">
                      📅
                    </div>

                    <p className="text-lg font-bold">
                      {formatDate(match.match_date)}
                    </p>
                  </div>

                  <span className="text-3xl font-bold text-purple-700">
                    ›
                  </span>
                </div>

                {match.players.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-purple-700">
                    <table className="w-full table-fixed text-center">
                      <thead className="bg-purple-100">
                        <tr>
                          {match.players.map((player, index) => (
                            <th
                              key={player.id}
                              className={`py-2 ${
                                index !== match.players.length - 1
                                  ? "border-r border-purple-700"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span
                                  className="h-3 w-3 rounded-full border border-gray-300"
                                  style={{ backgroundColor: player.color }}
                                />
                                <span className="truncate">{player.name}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        <tr className="text-lg">
                          {match.players.map((player, index) => {
                            const totalScore = getTotalScore(
                              match.id,
                              player.id
                            );

                            const rankCounts = getRankCounts(
                              match.id,
                              player.id
                            );

                            return (
                              <td
                                key={player.id}
                                className={`py-3 font-bold ${
                                  totalScore > 0
                                    ? "text-green-600"
                                    : totalScore < 0
                                    ? "text-red-600"
                                    : "text-gray-500"
                                } ${
                                  index !== match.players.length - 1
                                    ? "border-r border-purple-700"
                                    : ""
                                }`}
                              >
                                <div>{formatScore(totalScore)}</div>

                                <div className="mt-2 border-t border-gray-300 pt-2 text-[11px] font-normal leading-relaxed text-gray-500">
                                  <div className="flex justify-center gap-2">
                                    <span>
                                      1位
                                      <span className="font-bold text-rose-400">
                                        {rankCounts[1] ?? 0}
                                      </span>
                                    </span>

                                    <span>
                                      2位
                                      <span className="font-bold text-rose-400">
                                        {rankCounts[2] ?? 0}
                                      </span>
                                    </span>
                                  </div>

                                  <div className="flex justify-center gap-2">
                                    <span>
                                      3位
                                      <span className="font-bold text-rose-400">
                                        {rankCounts[3] ?? 0}
                                      </span>
                                    </span>

                                    {match.players.length >= 4 && (
                                      <span>
                                        4位
                                        <span className="font-bold text-rose-400">
                                          {rankCounts[4] ?? 0}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-500">
                    参加メンバー情報がありません
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2 text-sm font-bold text-gray-500">
                  <span className="text-purple-700">▦</span>
                  <span>半荘数：{match.gameCount}半荘</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}