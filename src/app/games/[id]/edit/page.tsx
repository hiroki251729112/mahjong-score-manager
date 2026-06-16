"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Game = {
  id: number;
  match_id: number;
  game_number: number;
};

type Match = {
  id: number;
  name: string;
  return_point: string;
  uma: string;
  split_uma: string;
  bankruptcy: string;
  tip: string;
};

type Member = {
  id: number;
  name: string;
  color: string;
};

type MatchPlayer = {
  member_id: number;
  seat_order: number;
};

type GameResult = {
  id: number;
  game_id: number;
  member_id: number;
  rank: number;
  raw_score: number;
  base_point: number;
  uma_point: number;
  final_score: number;
  chip: number;
};

type Result = {
  memberId: number;
  rawScore: number;
  rank: number;
  basePoint: number;
  umaPoint: number;
  finalScore: number;
  chip: number;
};

export default function EditGamePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const gameId = Number(params.id);
  const queryMatchId = searchParams.get("matchId");

  const [game, setGame] = useState<Game | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Member[]>([]);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [chips, setChips] = useState<Record<number, number>>({});
  const [showChipInput, setShowChipInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const matchId = game?.match_id ?? Number(queryMatchId);

  useEffect(() => {
    const fetchData = async () => {
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) {
        alert("対局情報の取得に失敗しました");
        console.error(gameError);
        setLoading(false);
        return;
      }

      const fetchedGame = gameData as Game;

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", fetchedGame.match_id)
        .single();

      if (matchError) {
        alert("対戦情報の取得に失敗しました");
        console.error(matchError);
        setLoading(false);
        return;
      }

      const fetchedMatch = matchData as Match;
      const chipEnabled = fetchedMatch.tip !== "なし";

      const { data: playerData, error: playerError } = await supabase
        .from("match_players")
        .select("*")
        .eq("match_id", fetchedGame.match_id)
        .order("seat_order", { ascending: true });

      if (playerError) {
        alert("参加メンバーの取得に失敗しました");
        console.error(playerError);
        setLoading(false);
        return;
      }

      const memberIds = (playerData ?? []).map(
        (player: MatchPlayer) => player.member_id
      );

      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .in("id", memberIds);

      if (memberError) {
        alert("メンバー情報の取得に失敗しました");
        console.error(memberError);
        setLoading(false);
        return;
      }

      const sortedPlayers = (playerData ?? [])
        .map((player: MatchPlayer) =>
          (memberData ?? []).find(
            (member: Member) => member.id === player.member_id
          )
        )
        .filter(Boolean) as Member[];

      const { data: resultData, error: resultError } = await supabase
        .from("game_results")
        .select("*")
        .eq("game_id", gameId);

      if (resultError) {
        alert("対局結果の取得に失敗しました");
        console.error(resultError);
        setLoading(false);
        return;
      }

      const nextScores: Record<number, string> = {};
      const nextChips: Record<number, number> = {};

      sortedPlayers.forEach((player) => {
        const result = (resultData ?? []).find(
          (item: GameResult) => item.member_id === player.id
        );

        nextScores[player.id] = result ? String(result.raw_score / 100) : "";
        nextChips[player.id] = result?.chip ?? 0;
      });

      const hasChip = Object.values(nextChips).some((chip) => chip !== 0);

      setGame(fetchedGame);
      setMatch(fetchedMatch);
      setPlayers(sortedPlayers);
      setScores(nextScores);
      setChips(nextChips);
      setShowChipInput(chipEnabled && hasChip);
      setLoading(false);
    };

    fetchData();
  }, [gameId]);

  const getUmaValues = (uma: string, playerCount: number) => {
    if (playerCount === 3) {
      if (uma === "なし") return [0, 0, 0];

      const firstUma = Number(uma);

      if (!Number.isNaN(firstUma)) {
        return [firstUma, 0, -firstUma];
      }

      return [0, 0, 0];
    }

    if (uma === "なし") return [0, 0, 0, 0];
    if (uma === "5-10") return [10, 5, -5, -10];
    if (uma === "10-20") return [20, 10, -10, -20];
    if (uma === "10-30") return [30, 10, -10, -30];

    if (uma.includes("-")) {
      const [first, second] = uma.split("-");

      const firstUma = Number(first);
      const secondUma = Number(second);

      if (!Number.isNaN(firstUma) && !Number.isNaN(secondUma)) {
        return [secondUma, firstUma, -firstUma, -secondUma];
      }
    }

    return [0, 0, 0, 0];
  };

  const roundScoreByMyRule = (score: number, returnPoint: number) => {
    if (score > returnPoint) {
      return Math.floor(score / 1000) * 1000;
    }

    return Math.ceil(score / 1000) * 1000;
  };

  const getRank = (
    score: number,
    allResults: { memberId: number; rawScore: number }[]
  ) => {
    return allResults.filter((result) => result.rawScore > score).length + 1;
  };

  const getUmaPoint = (
    rawScore: number,
    sortedResults: { memberId: number; rawScore: number }[],
    umaValues: number[],
    splitUma: string
  ) => {
    const sameScoreIndexes = sortedResults
      .map((result, index) => ({ result, index }))
      .filter((item) => item.result.rawScore === rawScore)
      .map((item) => item.index);

    if (splitUma !== "あり") {
      return umaValues[sameScoreIndexes[0]] ?? 0;
    }

    const umaTotal = sameScoreIndexes.reduce((sum, index) => {
      return sum + (umaValues[index] ?? 0);
    }, 0);

    return umaTotal / sameScoreIndexes.length;
  };

  const totalInputScore = players.reduce((total, player) => {
    const input = scores[player.id];

    if (!input || !/^-?\d+$/.test(input)) {
      return total;
    }

    return total + Number(input);
  }, 0);

  const expectedTotal = players.length === 3 ? 700 : 1000;
  const isTotalCorrect = totalInputScore === expectedTotal;
  const chipEnabled = match?.tip !== "なし";

  const calculateResults = (): Result[] | null => {
    if (!match) return null;

    const returnPoint = Number(match.return_point);
    const playerCount = players.length;

    const rawResults = players.map((player) => {
      const input = scores[player.id];

      if (!input || !/^-?\d+$/.test(input)) {
        return null;
      }

      let rawScore = Number(input) * 100;

      if (match.bankruptcy === "なし" && rawScore < 0) {
        rawScore = 0;
      }

      return {
        memberId: player.id,
        rawScore,
      };
    });

    if (rawResults.some((result) => result === null)) {
      alert("全員の点数を整数で入力してください");
      return null;
    }

    if (!isTotalCorrect) {
      alert(
        `点数の合計が正しくありません。合計は${expectedTotal}になる必要があります。`
      );
      return null;
    }

    const results = rawResults as { memberId: number; rawScore: number }[];
    const sorted = [...results].sort((a, b) => b.rawScore - a.rawScore);
    const umaValues = getUmaValues(match.uma, playerCount);

    const calculated: Result[] = sorted.map((result) => {
      const rank = getRank(result.rawScore, sorted);
      const roundedScore = roundScoreByMyRule(result.rawScore, returnPoint);
      const basePoint = (roundedScore - returnPoint) / 1000;
      const umaPoint = getUmaPoint(
        result.rawScore,
        sorted,
        umaValues,
        match.split_uma
      );
      const chip = chipEnabled ? chips[result.memberId] ?? 0 : 0;

      return {
        memberId: result.memberId,
        rawScore: result.rawScore,
        rank,
        basePoint,
        umaPoint,
        finalScore: basePoint + umaPoint,
        chip,
      };
    });

    const total = calculated.reduce(
      (sum, result) => sum + result.finalScore,
      0
    );

    const topResults = calculated.filter((result) => result.rank === 1);

    if (topResults.length > 0 && total !== 0) {
      const adjustment = -total / topResults.length;

      calculated.forEach((result) => {
        if (result.rank === 1) {
          result.finalScore += adjustment;
        }
      });
    }

    return calculated;
  };

  const changeChip = (memberId: number, amount: number) => {
    setChips((prev) => ({
      ...prev,
      [memberId]: (prev[memberId] ?? 0) + amount,
    }));
  };

  const updateGame = async () => {
    if (saving) return;

    const results = calculateResults();
    if (!results || !game) return;

    setSaving(true);

    const { error: deleteError } = await supabase
      .from("game_results")
      .delete()
      .eq("game_id", game.id);

    if (deleteError) {
      alert("既存の対局結果の削除に失敗しました");
      console.error(deleteError);
      setSaving(false);
      return;
    }

    const gameResults = results.map((result) => ({
      game_id: game.id,
      member_id: result.memberId,
      rank: result.rank,
      raw_score: result.rawScore,
      base_point: result.basePoint,
      uma_point: result.umaPoint,
      final_score: result.finalScore,
      chip: result.chip,
    }));

    const { error: insertError } = await supabase
      .from("game_results")
      .insert(gameResults);

    if (insertError) {
      alert("対局結果の更新に失敗しました");
      console.error(insertError);
      setSaving(false);
      return;
    }

    router.push(`/matches/${game.match_id}`);
  };

  if (loading || !game || !match) {
    return (
      <main className="min-h-screen bg-gray-100 p-4">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <Link
        href={`/matches/${game.match_id}`}
        className="mb-4 inline-block text-sm text-purple-700"
      >
        ← 編集をやめる
      </Link>

      <h1 className="mb-2 text-2xl font-bold">対局編集</h1>

      <p className="mb-6 text-sm text-gray-500">{game.game_number}回目</p>

      <div className="space-y-5">
        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-bold">点数入力</h2>

          <p className="mb-4 text-sm text-gray-500">
            ※点数は100点単位で入力してください。例：381→38100点、132→13200点、-5→-500点
          </p>

          <div className="space-y-4">
            {players.map((player) => (
              <div key={player.id} className="space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <span
                    className="h-4 w-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: player.color }}
                  />
                  {player.name}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    value={scores[player.id] ?? ""}
                    onChange={(e) =>
                      setScores({ ...scores, [player.id]: e.target.value })
                    }
                    className="min-w-0 flex-1 rounded-lg border p-3"
                    placeholder="381"
                    inputMode="numeric"
                  />

                  <span className="whitespace-nowrap font-bold text-gray-600">
                    ×100点
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            className={`mt-4 rounded-lg p-3 text-center font-bold ${
              isTotalCorrect
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            現在合計：{totalInputScore} / {expectedTotal}
          </div>
        </section>

        {chipEnabled && (
          <section className="rounded-xl bg-white p-4 shadow">
            <button
              type="button"
              onClick={() => setShowChipInput(!showChipInput)}
              className="flex w-full items-center justify-between font-bold"
            >
              <span>チップ入力（任意）</span>
              <span>{showChipInput ? "▲" : "▼"}</span>
            </button>

            {showChipInput && (
              <div className="mt-4 overflow-hidden rounded-lg border border-purple-700">
                <table className="w-full table-fixed text-center">
                  <thead className="bg-purple-100">
                    <tr>
                      {players.map((player, index) => (
                        <th
                          key={player.id}
                          className={`py-2 ${
                            index !== players.length - 1
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
                    <tr>
                      {players.map((player, index) => (
                        <td
                          key={player.id}
                          className={`py-4 ${
                            index !== players.length - 1
                              ? "border-r border-purple-700"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => changeChip(player.id, -1)}
                              className="h-8 w-8 rounded-full bg-gray-200 font-bold"
                            >
                              -
                            </button>

                            <span className="w-6 text-center text-lg font-bold">
                              {chips[player.id] ?? 0}
                            </span>

                            <button
                              type="button"
                              onClick={() => changeChip(player.id, 1)}
                              className="h-8 w-8 rounded-full bg-purple-700 font-bold text-white"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <button
          onClick={updateGame}
          disabled={saving}
          className={`w-full rounded-xl py-4 text-lg font-bold text-white ${
            saving ? "bg-gray-400" : "bg-purple-700"
          }`}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </main>
  );
}