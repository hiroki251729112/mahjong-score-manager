"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Match = {
  id: number;
  name: string;
  match_date: string;
  player_count: number;
  rate: string;
  tip: string;
  fee: string;
};

type Member = {
  id: number;
  name: string;
  color: string;
};

type MatchPlayer = {
  match_id: number;
  member_id: number;
  seat_order: number;
};

type Game = {
  id: number;
  match_id: number;
  game_number: number;
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

type MatchFee = {
  id: number;
  match_id: number;
  member_id: number;
  fee_share: number;
  fee_paid: number;
};

type MatchExpense = {
  id: number;
  match_id: number;
  member_id: number;
  expense_name: string;
  expense_share: number;
  expense_paid: number;
};

type GameWithResults = Game & {
  results: GameResult[];
};

type ExpenseSummaryItem = {
  name: string;
  share: number;
  paid: number;
  money: number;
};

type PaymentSummary = {
  memberId: number;
  totalScore: number;
  totalChip: number;
  scoreMoney: number;
  chipMoney: number;
  feeShare: number;
  feePaid: number;
  feeMoney: number;
  expenses: ExpenseSummaryItem[];
  expenseMoney: number;
  totalMoney: number;
};

type Settlement = {
  fromMemberId: number;
  toMemberId: number;
  amount: number;
};

function splitEvenly(total: number, count: number) {
  if (count <= 0) return [];

  const base = Math.floor(total / count);
  const remainder = total % count;

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = Number(params.id);

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Member[]>([]);
  const [games, setGames] = useState<GameWithResults[]>([]);
  const [matchFees, setMatchFees] = useState<MatchFee[]>([]);
  const [matchExpenses, setMatchExpenses] = useState<MatchExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseName, setExpenseName] = useState("延長料金");
  const [expenseTotal, setExpenseTotal] = useState("");
  const [expenseShares, setExpenseShares] = useState<Record<string, string>>(
    {}
  );
  const [expensePaids, setExpensePaids] = useState<Record<string, string>>({});

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

    return `${date.getFullYear()}年${
      date.getMonth() + 1
    }月${date.getDate()}日（${weekdays[date.getDay()]}）`;
  };

  const fetchMatchDetail = async () => {
    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError) {
      alert("対戦情報の取得に失敗しました");
      console.error(matchError);
      setLoading(false);
      return;
    }

    const { data: playerData, error: playerError } = await supabase
      .from("match_players")
      .select("*")
      .eq("match_id", matchId)
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

    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("match_id", matchId)
      .order("game_number", { ascending: true });

    if (gameError) {
      alert("対局情報の取得に失敗しました");
      console.error(gameError);
      setLoading(false);
      return;
    }

    const gameIds = (gameData ?? []).map((game: Game) => game.id);

    let resultData: GameResult[] = [];

    if (gameIds.length > 0) {
      const { data, error } = await supabase
        .from("game_results")
        .select("*")
        .in("game_id", gameIds)
        .order("rank", { ascending: true });

      if (error) {
        alert("対局結果の取得に失敗しました");
        console.error(error);
        setLoading(false);
        return;
      }

      resultData = (data ?? []) as GameResult[];
    }

    const { data: feeData, error: feeError } = await supabase
      .from("match_fees")
      .select("*")
      .eq("match_id", matchId);

    if (feeError) {
      alert("場代情報の取得に失敗しました");
      console.error(feeError);
      setLoading(false);
      return;
    }

    const { data: expenseData, error: expenseError } = await supabase
      .from("match_expenses")
      .select("*")
      .eq("match_id", matchId)
      .order("id", { ascending: true });

    if (expenseError) {
      alert("追加支出の取得に失敗しました");
      console.error(expenseError);
      setLoading(false);
      return;
    }

    const gamesWithResults = ((gameData ?? []) as Game[]).map((game) => ({
      ...game,
      results: resultData.filter((result) => result.game_id === game.id),
    }));

    setMatch(matchData as Match);
    setPlayers(sortedPlayers);
    setGames(gamesWithResults);
    setMatchFees((feeData ?? []) as MatchFee[]);
    setMatchExpenses((expenseData ?? []) as MatchExpense[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isNaN(matchId)) {
      fetchMatchDetail();
    }
  }, [matchId]);

  const getRateValue = (rate: string) => {
    if (rate === "なし") return 0;
    if (rate === "テンイチ") return 10;
    if (rate === "テンニ") return 20;
    if (rate === "テンサン") return 30;
    if (rate === "テンヨン") return 40;
    if (rate === "テンゴ") return 50;
    if (rate === "テンピン") return 100;

    const customRate = Number(rate);
    return Number.isNaN(customRate) ? 0 : customRate;
  };

  const getTipValue = (tip: string) => {
    if (tip === "なし") return 0;

    const customTip = Number(tip);
    return Number.isNaN(customTip) ? 0 : customTip;
  };

  const getTotalScore = (memberId: number) => {
    return games.reduce((total, game) => {
      const result = game.results.find((r) => r.member_id === memberId);
      return total + (result?.final_score ?? 0);
    }, 0);
  };

  const getTotalChip = (memberId: number) => {
    return games.reduce((total, game) => {
      const result = game.results.find((r) => r.member_id === memberId);
      return total + (result?.chip ?? 0);
    }, 0);
  };

  const getRankCounts = (memberId: number) => {
    const counts: Record<number, number> = {};

    games.forEach((game) => {
      const result = game.results.find((item) => item.member_id === memberId);

      if (result) {
        counts[result.rank] = (counts[result.rank] ?? 0) + 1;
      }
    });

    return counts;
  };

  const getFee = (memberId: number) => {
    return matchFees.find((item) => item.member_id === memberId);
  };

  const getExpenses = (memberId: number) => {
    return matchExpenses
      .filter((expense) => expense.member_id === memberId)
      .map((expense) => ({
        name: expense.expense_name,
        share: expense.expense_share,
        paid: expense.expense_paid,
        money: expense.expense_paid - expense.expense_share,
      }));
  };

  const chipEnabled = match?.tip !== "なし";

  const hasAnyChip = () => {
    if (!chipEnabled) return false;

    return games.some((game) =>
      game.results.some((result) => result.chip !== 0)
    );
  };

  const hasAnyFee = () => {
    return match?.fee === "あり" && matchFees.length > 0;
  };

  const formatScore = (score: number) => {
    if (score > 0) return `+${score}`;
    return `${score}`;
  };

  const formatYen = (amount: number) => {
    if (amount > 0) return `+${amount.toLocaleString()}円`;
    return `${amount.toLocaleString()}円`;
  };

  const getMemberName = (memberId: number) => {
    return players.find((player) => player.id === memberId)?.name ?? "";
  };

  const getResultByMember = (game: GameWithResults, memberId: number) => {
    return game.results.find((result) => result.member_id === memberId);
  };

  const rateValue = getRateValue(match?.rate ?? "なし");
  const tipValue = getTipValue(match?.tip ?? "なし");
  const showScoreMoney = rateValue > 0;
  const showChipMoney = hasAnyChip() && tipValue > 0;
  const showFeeMoney = hasAnyFee();
  const showExpenseMoney = matchExpenses.length > 0;
  const showChipRow = hasAnyChip();

  const expenseTotalNumber =
    expenseTotal !== "" && /^\d+$/.test(expenseTotal)
      ? Number(expenseTotal)
      : 0;

  const expenseShareTotal = players.reduce((total, player) => {
    const value = expenseShares[String(player.id)];
    return total + (value && /^\d+$/.test(value) ? Number(value) : 0);
  }, 0);

  const expensePaidTotal = players.reduce((total, player) => {
    const value = expensePaids[String(player.id)];
    return total + (value && /^\d+$/.test(value) ? Number(value) : 0);
  }, 0);

  const isExpenseShareCorrect =
    expenseTotal === "" || expenseShareTotal === expenseTotalNumber;

  const isExpensePaidCorrect =
    expenseTotal === "" || expensePaidTotal === expenseTotalNumber;

  const applyEvenExpenseShare = () => {
    if (expenseTotal === "" || !/^\d+$/.test(expenseTotal)) return;

    const values = splitEvenly(Number(expenseTotal), players.length);
    const nextShares: Record<string, string> = {};

    players.forEach((player, index) => {
      nextShares[String(player.id)] = String(values[index] ?? 0);
    });

    setExpenseShares(nextShares);
  };

  const saveExpense = async () => {
    if (savingExpense) return;

    const name = expenseName.trim();

    if (name === "") {
      alert("支出名を入力してください");
      return;
    }

    if (expenseTotal === "" || !/^\d+$/.test(expenseTotal)) {
      alert("支出の合計金額を整数で入力してください");
      return;
    }

    const duplicateExpense = matchExpenses.some(
      (expense) => expense.expense_name === name
    );

    if (duplicateExpense) {
      alert("同じ名前の支出が既にあります");
      return;
    }

    if (!isExpenseShareCorrect) {
      alert("負担額の合計が支出の合計金額と一致していません");
      return;
    }

    if (!isExpensePaidCorrect) {
      alert("支払額の合計が支出の合計金額と一致していません");
      return;
    }

    setSavingExpense(true);

    const expenseRows = players.map((player) => ({
      match_id: matchId,
      member_id: player.id,
      expense_name: name,
      expense_share: Number(expenseShares[String(player.id)] ?? 0),
      expense_paid: Number(expensePaids[String(player.id)] ?? 0),
    }));

    const { error } = await supabase
      .from("match_expenses")
      .insert(expenseRows);

    if (error) {
      alert("支出の保存に失敗しました");
      console.error(error);
      setSavingExpense(false);
      return;
    }

    setExpenseName("延長料金");
    setExpenseTotal("");
    setExpenseShares({});
    setExpensePaids({});
    setShowExpenseForm(false);
    setSavingExpense(false);

    fetchMatchDetail();
  };
  
  const paymentSummaries: PaymentSummary[] = players.map((player) => {
    const fee = getFee(player.id);
    const expenses = getExpenses(player.id);

    const totalScore = getTotalScore(player.id);
    const totalChip = getTotalChip(player.id);

    const scoreMoney = showScoreMoney ? totalScore * rateValue : 0;
    const chipMoney = showChipMoney ? totalChip * tipValue : 0;

    const feeShare = fee?.fee_share ?? 0;
    const feePaid = fee?.fee_paid ?? 0;
    const feeMoney = showFeeMoney ? feePaid - feeShare : 0;

    const expenseMoney = expenses.reduce(
      (total, expense) => total + expense.money,
      0
    );

    return {
      memberId: player.id,
      totalScore,
      totalChip,
      scoreMoney,
      chipMoney,
      feeShare,
      feePaid,
      feeMoney,
      expenses,
      expenseMoney,
      totalMoney: scoreMoney + chipMoney + feeMoney + expenseMoney,
    };
  });

  const settlements: Settlement[] = (() => {
    const debtors = paymentSummaries
      .filter((summary) => summary.totalMoney < 0)
      .map((summary) => ({
        memberId: summary.memberId,
        amount: Math.abs(summary.totalMoney),
      }));

    const creditors = paymentSummaries
      .filter((summary) => summary.totalMoney > 0)
      .map((summary) => ({
        memberId: summary.memberId,
        amount: summary.totalMoney,
      }));

    const result: Settlement[] = [];

    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];

      const amount = Math.min(debtor.amount, creditor.amount);

      if (amount > 0) {
        result.push({
          fromMemberId: debtor.memberId,
          toMemberId: creditor.memberId,
          amount,
        });
      }

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount === 0) debtorIndex += 1;
      if (creditor.amount === 0) creditorIndex += 1;
    }

    return result;
  })();

  const deleteGame = async (gameId: number) => {
    const ok = window.confirm("この対局を削除しますか？");

    if (!ok) return;

    const { error: resultError } = await supabase
      .from("game_results")
      .delete()
      .eq("game_id", gameId);

    if (resultError) {
      alert("対局結果の削除に失敗しました");
      console.error(resultError);
      return;
    }

    const { error: gameError } = await supabase
      .from("games")
      .delete()
      .eq("id", gameId);

    if (gameError) {
      alert("対局の削除に失敗しました");
      console.error(gameError);
      return;
    }

    fetchMatchDetail();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }
  if (!match) {
    return (
      <main className="min-h-screen bg-gray-100 p-4">
        <p className="text-gray-500">対戦が見つかりません</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <Link href="/" className="mb-4 inline-block text-sm text-purple-700">
        ← ホームへ戻る
      </Link>

      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{formatDate(match.match_date)}</h1>

        <Link href={`/matches/${matchId}/settings`}>
          <button className="whitespace-nowrap rounded-lg bg-purple-700 px-3 py-2 text-sm font-bold text-white">
            対戦ルール変更
          </button>
        </Link>
      </div>

      <section className="mb-5 overflow-hidden rounded-2xl shadow-lg">
        <div className="bg-purple-700 px-4 py-3 text-white">
          <h2 className="text-lg font-bold">総合成績</h2>
          <p className="text-sm opacity-90">{games.length}回分の合計</p>
        </div>

        <div className="bg-white p-4">
          <div className="overflow-hidden rounded-lg border border-purple-700">
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
                <tr className="text-xl">
                  {players.map((player, index) => {
                    const score = getTotalScore(player.id);
                    const chip = getTotalChip(player.id);
                    const rankCounts = getRankCounts(player.id);

                    return (
                      <td
                        key={player.id}
                        className={`align-top font-bold ${
                          score > 0
                            ? "text-green-600"
                            : score < 0
                            ? "text-red-600"
                            : "text-gray-500"
                        } ${
                          index !== players.length - 1
                            ? "border-r border-purple-700"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="py-6 text-center text-2xl">
                            {formatScore(score)}
                          </div>

                          <div className="border-t border-gray-300 px-1 pt-2 text-[11px] font-normal leading-relaxed text-gray-500">
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

                              {players.length >= 4 && (
                                <span>
                                  4位
                                  <span className="font-bold text-rose-400">
                                    {rankCounts[4] ?? 0}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          {showChipRow && (
                            <div className="mt-1 pb-2 text-xs font-normal text-gray-500">
                              チップ {chip !== 0 ? formatScore(chip) : "0"}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Link href={`/matches/${matchId}/add-game`}>
        <button className="mb-5 w-full rounded-xl bg-sky-500 py-3 font-bold text-white shadow-md">
          ＋ 対局結果を追加
        </button>
      </Link>

      {games.length === 0 ? (
        <div className="rounded-xl bg-white p-4 text-gray-500 shadow">
          対局結果はまだありません
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <section
              key={game.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow"
            >
              <div className="flex items-center justify-between bg-gray-100 px-4 py-2">
                <h2 className="font-bold">{game.game_number}回目</h2>

                <div className="flex gap-2">
                  <Link href={`/games/${game.id}/edit?matchId=${matchId}`}>
                    <button className="rounded bg-purple-700 px-3 py-1 text-xs font-bold text-white">
                      編集
                    </button>
                  </Link>

                  <button
                    onClick={() => deleteGame(game.id)}
                    className="rounded bg-red-500 px-3 py-1 text-xs font-bold text-white"
                  >
                    削除
                  </button>
                </div>
              </div>

              <div className="p-3">
                <div className="overflow-hidden rounded-lg border border-purple-700">
                  <table className="w-full table-fixed text-center">
                    <thead className="bg-purple-100">
                      <tr>
                        {players.map((player, index) => (
                          <th
                            key={player.id}
                            className={`py-1.5 text-sm ${
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
                      <tr className="text-lg">
                        {players.map((player, index) => {
                          const result = getResultByMember(game, player.id);
                          const score = result?.final_score ?? 0;

                          return (
                            <td
                              key={player.id}
                              className={`py-2 font-bold ${
                                score > 0
                                  ? "text-green-600"
                                  : score < 0
                                  ? "text-red-600"
                                  : "text-gray-500"
                              } ${
                                index !== players.length - 1
                                  ? "border-r border-purple-700"
                                  : ""
                              }`}
                            >
                              <div className="leading-none">
                                {formatScore(score)}
                              </div>

                              {result && (
                                <div className="mt-1 space-y-0 text-[10px] font-normal leading-tight text-gray-500">
                                  <div>
                                    {result.rank}位 / {result.raw_score}点
                                  </div>

                                  <div>
                                    スコア：
                                    {result.base_point > 0 ? "+" : ""}
                                    {result.base_point}
                                  </div>

                                  <div>
                                    ウマ：
                                    {result.uma_point > 0 ? "+" : ""}
                                    {result.uma_point}
                                  </div>

                                  {chipEnabled && result.chip !== 0 && (
                                    <div>
                                      チップ：
                                      {result.chip > 0 ? "+" : ""}
                                      {result.chip}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="mt-5 rounded-xl bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">支出計算</h2>

          <Link href={`/matches/${matchId}/expenses`}>
            <button className="rounded-lg bg-purple-700 px-3 py-2 text-sm font-bold text-white">
              編集
            </button>
          </Link>
        </div>

        {!showScoreMoney &&
        !showChipMoney &&
        !showFeeMoney &&
        !showExpenseMoney ? (
          <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-500">
            支出計算に使う設定がありません
          </p>
        ) : (
          <div className="space-y-3">
            {paymentSummaries.map((summary) => (
              <div
                key={summary.memberId}
                className="rounded-lg bg-gray-100 p-3"
              >
                <div className="mb-2 font-bold">
                  {getMemberName(summary.memberId)}
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  {showScoreMoney && (
                    <div>
                      スコア：{formatScore(summary.totalScore)} × {rateValue}
                      円 = {formatYen(summary.scoreMoney)}
                    </div>
                  )}

                  {showChipMoney && (
                    <div>
                      チップ：{formatScore(summary.totalChip)}枚 × {tipValue}
                      円 = {formatYen(summary.chipMoney)}
                    </div>
                  )}

                  {showFeeMoney && (
                    <div>
                      場代：{summary.feePaid.toLocaleString()}円 -{" "}
                      {summary.feeShare.toLocaleString()}円 ={" "}
                      {formatYen(summary.feeMoney)}
                    </div>
                  )}

                  {summary.expenses.map((expense, index) => (
                    <div key={`${summary.memberId}-${expense.name}-${index}`}>
                      {expense.name}：{expense.paid.toLocaleString()}円 -{" "}
                      {expense.share.toLocaleString()}円 ={" "}
                      {formatYen(expense.money)}
                    </div>
                  ))}

                  <div
                    className={`pt-1 font-bold ${
                      summary.totalMoney > 0
                        ? "text-green-600"
                        : summary.totalMoney < 0
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    合計：{formatYen(summary.totalMoney)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowExpenseForm(!showExpenseForm)}
          className="mt-5 w-full rounded-xl bg-purple-700 py-3 font-bold text-white shadow-md"
        >
          {showExpenseForm ? "支出追加を閉じる" : "＋ 支出を追加"}
        </button>

        {showExpenseForm && (
          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
            <h3 className="mb-4 text-lg font-bold text-purple-800">
              支出を追加
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block font-bold">支出名</label>
                <input
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  placeholder="延長料金"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold">合計金額</label>
                <input
                  value={expenseTotal}
                  onChange={(e) => setExpenseTotal(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  placeholder="2000"
                  inputMode="numeric"
                />
              </div>

              <button
                type="button"
                onClick={applyEvenExpenseShare}
                className="w-full rounded-lg border-2 border-purple-700 bg-white py-2 font-bold text-purple-700"
              >
                合計金額を均等に割る
              </button>

              <div>
                <h4 className="mb-2 font-bold text-purple-800">
                  各メンバーの負担額
                </h4>

                <div className="space-y-3">
                  {players.map((player) => (
                    <div key={player.id}>
                      <label className="mb-1 flex items-center gap-2 font-bold">
                        <span
                          className="h-4 w-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: player.color }}
                        />
                        {player.name}
                      </label>

                      <input
                        value={expenseShares[String(player.id)] ?? ""}
                        onChange={(e) =>
                          setExpenseShares({
                            ...expenseShares,
                            [String(player.id)]: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border p-3"
                        placeholder="負担額"
                        inputMode="numeric"
                      />
                    </div>
                  ))}
                </div>

                <div
                  className={`mt-3 rounded-lg p-3 text-center font-bold ${
                    isExpenseShareCorrect
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  負担額合計：{expenseShareTotal} / {expenseTotalNumber}
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-bold text-purple-800">
                  実際に払った金額
                </h4>

                <div className="space-y-3">
                  {players.map((player) => (
                    <div key={player.id}>
                      <label className="mb-1 flex items-center gap-2 font-bold">
                        <span
                          className="h-4 w-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: player.color }}
                        />
                        {player.name}
                      </label>

                      <input
                        value={expensePaids[String(player.id)] ?? ""}
                        onChange={(e) =>
                          setExpensePaids({
                            ...expensePaids,
                            [String(player.id)]: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border p-3"
                        placeholder="支払額"
                        inputMode="numeric"
                      />
                    </div>
                  ))}
                </div>

                <div
                  className={`mt-3 rounded-lg p-3 text-center font-bold ${
                    isExpensePaidCorrect
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  支払額合計：{expensePaidTotal} / {expenseTotalNumber}
                </div>
              </div>

              <button
                onClick={saveExpense}
                disabled={savingExpense}
                className={`w-full rounded-xl py-3 font-bold text-white ${
                  savingExpense ? "bg-gray-400" : "bg-purple-700"
                }`}
              >
                {savingExpense ? "保存中..." : "支出を保存"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5">
          <h3 className="mb-3 font-bold">精算方法</h3>

          {settlements.length === 0 ? (
            <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-500">
              精算はありません
            </p>
          ) : (
            <div className="space-y-2">
              {settlements.map((settlement, index) => (
                <div
                  key={`${settlement.fromMemberId}-${settlement.toMemberId}-${index}`}
                  className="rounded-lg bg-gray-100 p-3 text-sm font-bold"
                >
                  {getMemberName(settlement.fromMemberId)} →{" "}
                  {getMemberName(settlement.toMemberId)}{" "}
                  {settlement.amount.toLocaleString()}円
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}