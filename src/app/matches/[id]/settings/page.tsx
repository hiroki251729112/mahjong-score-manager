"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Match = {
  id: number;
  match_date: string;
  player_count: number;
  start_point: string;
  return_point: string;
  uma: string;
  split_uma: string;
  rate: string;
  bankruptcy: string;
  fee: string;
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

type MatchFee = {
  id: number;
  match_id: number;
  member_id: number;
  fee_share: number;
  fee_paid: number;
};

type TileOptionProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

function TileOption({ label, selected, onClick }: TileOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-4 px-4 py-3 text-center font-bold shadow-sm ${
        selected
          ? "border-purple-700 bg-purple-100 text-purple-900"
          : "border-purple-700 bg-gray-300 text-black"
      }`}
    >
      {label}
    </button>
  );
}

type SectionProps = {
  title: string;
  value: string;
  children: React.ReactNode;
};

function Section({ title, value, children }: SectionProps) {
  return (
    <section className="rounded-xl bg-white p-4 shadow">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-8 w-2 bg-purple-700" />
        <h2 className="text-xl font-bold">{title}</h2>
        <span className="text-xl font-bold text-purple-700">{value}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

const tipOptions = ["なし", "100", "200", "300", "400", "500", "600", "その他"];

function getTipLabel(value: string) {
  if (value === "なし") return "なし";
  if (value === "その他") return "その他";
  return `${value}円/1枚`;
}

function splitEvenly(total: number, count: number) {
  if (count <= 0) return [];

  const base = Math.floor(total / count);
  const remainder = total % count;

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

export default function MatchSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [matchDate, setMatchDate] = useState("");
  const [playerCount, setPlayerCount] = useState(4);

  const [startPoint, setStartPoint] = useState("25000");
  const [customStartPoint, setCustomStartPoint] = useState("");

  const [returnPoint, setReturnPoint] = useState("30000");
  const [customReturnPoint, setCustomReturnPoint] = useState("");

  const [uma, setUma] = useState("10-30");
  const [customUmaFirst, setCustomUmaFirst] = useState("");
  const [customUmaSecond, setCustomUmaSecond] = useState("");

  const [splitUma, setSplitUma] = useState("あり");

  const [rate, setRate] = useState("テンゴ");
  const [customRate, setCustomRate] = useState("");

  const [bankruptcy, setBankruptcy] = useState("あり");
  const [fee, setFee] = useState("なし");

  const [tip, setTip] = useState("なし");
  const [customTip, setCustomTip] = useState("");

  const [players, setPlayers] = useState<Member[]>([]);
  const [feeTotal, setFeeTotal] = useState("");
  const [feeShares, setFeeShares] = useState<Record<string, string>>({});
  const [feePaids, setFeePaids] = useState<Record<string, string>>({});

  const isThreePlayer = playerCount === 3;

  useEffect(() => {
    const fetchData = async () => {
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

      const match = matchData as Match;

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

      const nextFeeShares: Record<string, string> = {};
      const nextFeePaids: Record<string, string> = {};

      (feeData ?? []).forEach((item: MatchFee) => {
        const key = String(item.member_id);
        nextFeeShares[key] = String(item.fee_share ?? 0);
        nextFeePaids[key] = String(item.fee_paid ?? 0);
      });

      const feeTotalValue = (feeData ?? []).reduce(
        (total: number, item: MatchFee) => total + Number(item.fee_share ?? 0),
        0
      );

      const loadedStartPoint = match.start_point ?? "25000";
      const loadedReturnPoint = match.return_point ?? "30000";
      const loadedUma = match.uma ?? "10-30";
      const loadedRate = match.rate ?? "テンゴ";

      setMatchDate(match.match_date ?? "");
      setPlayerCount(match.player_count ?? sortedPlayers.length);

      if (!["25000", "30000", "35000", "40000"].includes(loadedStartPoint)) {
        setStartPoint("その他");
        setCustomStartPoint(loadedStartPoint);
      } else {
        setStartPoint(loadedStartPoint);
      }

      if (!["30000", "35000", "40000", "45000"].includes(loadedReturnPoint)) {
        setReturnPoint("その他");
        setCustomReturnPoint(loadedReturnPoint);
      } else {
        setReturnPoint(loadedReturnPoint);
      }

      if (
        ![
          "なし",
          "5-10",
          "10-20",
          "10-30",
          "10",
          "15",
          "20",
        ].includes(loadedUma)
      ) {
        setUma("その他");

        if (loadedUma.includes("-")) {
          const [first, second] = loadedUma.split("-");
          setCustomUmaFirst(first ?? "");
          setCustomUmaSecond(second ?? "");
        } else {
          setCustomUmaFirst(loadedUma);
          setCustomUmaSecond("");
        }
      } else {
        setUma(loadedUma);
      }

      setSplitUma(match.split_uma ?? "あり");

      if (
        ![
          "なし",
          "テンイチ",
          "テンニ",
          "テンサン",
          "テンヨン",
          "テンゴ",
          "テンピン",
        ].includes(loadedRate)
      ) {
        setRate("その他");
        setCustomRate(loadedRate);
      } else {
        setRate(loadedRate);
      }

      setBankruptcy(match.bankruptcy ?? "あり");
      setFee(match.fee ?? "なし");

      if (
        match.tip &&
        !["なし", "100", "200", "300", "400", "500", "600"].includes(match.tip)
      ) {
        setTip("その他");
        setCustomTip(match.tip);
      } else {
        setTip(match.tip ?? "なし");
      }

      setPlayers(sortedPlayers);
      setFeeShares(nextFeeShares);
      setFeePaids(nextFeePaids);
      setFeeTotal(feeTotalValue > 0 ? String(feeTotalValue) : "");

      setLoading(false);
    };

    fetchData();
  }, [matchId]);

  const feeTotalNumber =
    feeTotal !== "" && /^\d+$/.test(feeTotal) ? Number(feeTotal) : 0;

  const feeShareTotal = players.reduce((total, player) => {
    const value = feeShares[String(player.id)];
    return total + (value && /^\d+$/.test(value) ? Number(value) : 0);
  }, 0);

  const feePaidTotal = players.reduce((total, player) => {
    const value = feePaids[String(player.id)];
    return total + (value && /^\d+$/.test(value) ? Number(value) : 0);
  }, 0);

  const isFeeShareCorrect = fee === "なし" || feeShareTotal === feeTotalNumber;
  const isFeePaidCorrect = fee === "なし" || feePaidTotal === feeTotalNumber;

  const getUmaDisplayValue = () => {
    if (uma !== "その他") return uma;

    if (isThreePlayer) {
      return customUmaFirst || "未入力";
    }

    if (customUmaFirst || customUmaSecond) {
      return `${customUmaFirst || "未入力"}-${customUmaSecond || "未入力"}`;
    }

    return "未入力";
  };

  const applyEvenFeeShare = () => {
    if (feeTotal === "" || !/^\d+$/.test(feeTotal)) {
      alert("場代の合計金額を整数で入力してください");
      return;
    }

    const values = splitEvenly(Number(feeTotal), players.length);
    const nextShares: Record<string, string> = {};

    players.forEach((player, index) => {
      nextShares[String(player.id)] = String(values[index] ?? 0);
    });

    setFeeShares(nextShares);
  };

  const validateAndSave = async () => {
    if (saving) return;

    const startPointValue =
      startPoint === "その他" ? customStartPoint.trim() : startPoint;

    const returnPointValue =
      returnPoint === "その他" ? customReturnPoint.trim() : returnPoint;

    const umaValue =
      uma === "その他"
        ? isThreePlayer
          ? customUmaFirst.trim()
          : `${customUmaFirst.trim()}-${customUmaSecond.trim()}`
        : uma;

    const rateValue = rate === "その他" ? customRate.trim() : rate;
    const tipValue = tip === "その他" ? customTip.trim() : tip;

    if (startPointValue === "" || !/^\d+$/.test(startPointValue)) {
      alert("持ち点を整数で入力してください");
      return;
    }

    if (returnPointValue === "" || !/^\d+$/.test(returnPointValue)) {
      alert("返し点を整数で入力してください");
      return;
    }

    if (uma === "その他") {
      if (customUmaFirst.trim() === "" || !/^\d+$/.test(customUmaFirst.trim())) {
        alert("1位ウマを整数で入力してください");
        return;
      }

      if (
        !isThreePlayer &&
        (customUmaSecond.trim() === "" || !/^\d+$/.test(customUmaSecond.trim()))
      ) {
        alert("2位ウマを整数で入力してください");
        return;
      }
    }

    if (rate === "その他" && (rateValue === "" || !/^\d+$/.test(rateValue))) {
      alert("レートを整数で入力してください");
      return;
    }

    if (tip === "その他" && (tipValue === "" || !/^\d+$/.test(tipValue))) {
      alert("チップ単価を整数で入力してください");
      return;
    }

    if (fee === "あり") {
      if (feeTotal === "" || !/^\d+$/.test(feeTotal)) {
        alert("場代の合計金額を整数で入力してください");
        return;
      }

      if (!isFeeShareCorrect) {
        alert("負担額の合計が場代の合計金額と一致していません");
        return;
      }

      if (!isFeePaidCorrect) {
        alert("支払額の合計が場代の合計金額と一致していません");
        return;
      }
    }

    setSaving(true);

    const { error: matchError } = await supabase
      .from("matches")
      .update({
        match_date: matchDate,
        start_point: startPointValue,
        return_point: returnPointValue,
        uma: umaValue,
        split_uma: splitUma,
        rate: rateValue,
        bankruptcy,
        fee,
        tip: tipValue,
      })
      .eq("id", matchId);

    if (matchError) {
      alert("対戦ルールの保存に失敗しました");
      console.error(matchError);
      setSaving(false);
      return;
    }

    const { error: deleteFeeError } = await supabase
      .from("match_fees")
      .delete()
      .eq("match_id", matchId);

    if (deleteFeeError) {
      alert("既存の場代情報の削除に失敗しました");
      console.error(deleteFeeError);
      setSaving(false);
      return;
    }

    if (fee === "あり") {
      const matchFees = players.map((player) => {
        const key = String(player.id);

        return {
          match_id: matchId,
          member_id: player.id,
          fee_share: Number(feeShares[key] ?? 0),
          fee_paid: Number(feePaids[key] ?? 0),
        };
      });

      const { error: insertFeeError } = await supabase
        .from("match_fees")
        .insert(matchFees);

      if (insertFeeError) {
        alert("場代情報の保存に失敗しました");
        console.error(insertFeeError);
        setSaving(false);
        return;
      }
    }

    router.push(`/matches/${matchId}`);
  };

  const deleteMatch = async () => {
    const ok = window.confirm(
      "この対戦を削除しますか？\n対局結果・場代情報もすべて削除されます。"
    );

    if (!ok) return;

    const { data: games } = await supabase
      .from("games")
      .select("id")
      .eq("match_id", matchId);

    const gameIds = (games ?? []).map((game) => game.id);

    if (gameIds.length > 0) {
      await supabase.from("game_results").delete().in("game_id", gameIds);
    }

    await supabase.from("games").delete().eq("match_id", matchId);
    await supabase.from("match_players").delete().eq("match_id", matchId);
    await supabase.from("match_fees").delete().eq("match_id", matchId);
    await supabase.from("matches").delete().eq("id", matchId);

    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <Link
        href={`/matches/${matchId}`}
        className="mb-4 inline-block text-sm text-purple-700"
      >
        ← 対戦詳細へ戻る
      </Link>

      <h1 className="mb-6 text-2xl font-bold">対戦ルール変更</h1>

      <div className="space-y-5">
        <section className="rounded-xl bg-white p-4 shadow">
          <label className="mb-1 block font-bold">日付</label>

          <input
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            type="date"
            className="w-full rounded-lg border p-3"
          />
        </section>

        <section className="rounded-xl bg-white p-4 shadow">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-8 w-2 bg-purple-700" />
            <h2 className="text-xl font-bold">人数</h2>
            <span className="text-xl font-bold text-purple-700">
              {playerCount}人
            </span>
          </div>

          <p className="text-sm text-gray-500">
            ※人数と参加メンバーは、対局結果との整合性を保つため変更できません。
          </p>
        </section>

        <Section
          title="持ち点"
          value={
            startPoint === "その他"
              ? `${customStartPoint || "未入力"} 点`
              : `${startPoint} 点`
          }
        >
          {["25000", "30000", "35000", "40000", "その他"].map((item) => (
            <TileOption
              key={item}
              label={item === "その他" ? "その他" : `${item}点`}
              selected={startPoint === item}
              onClick={() => setStartPoint(item)}
            />
          ))}

          {startPoint === "その他" && (
            <div className="col-span-2 space-y-3 rounded-xl border-2 border-purple-300 bg-purple-50 p-3">
              <p className="font-bold text-purple-800">その他を選択中</p>

              <input
                value={customStartPoint}
                onChange={(e) => setCustomStartPoint(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="持ち点を整数で入力"
                inputMode="numeric"
              />
            </div>
          )}
        </Section>

        <Section
          title="返し点"
          value={
            returnPoint === "その他"
              ? `${customReturnPoint || "未入力"} 点`
              : `${returnPoint} 点`
          }
        >
          {["30000", "35000", "40000", "45000", "その他"].map((item) => (
            <TileOption
              key={item}
              label={item === "その他" ? "その他" : `${item}点`}
              selected={returnPoint === item}
              onClick={() => setReturnPoint(item)}
            />
          ))}

          {returnPoint === "その他" && (
            <div className="col-span-2 space-y-3 rounded-xl border-2 border-purple-300 bg-purple-50 p-3">
              <p className="font-bold text-purple-800">その他を選択中</p>

              <input
                value={customReturnPoint}
                onChange={(e) => setCustomReturnPoint(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="返し点を整数で入力"
                inputMode="numeric"
              />
            </div>
          )}
        </Section>

        <Section title="ウマ" value={getUmaDisplayValue()}>
          {(isThreePlayer
            ? ["なし", "10", "15", "20", "その他"]
            : ["なし", "5-10", "10-20", "10-30", "その他"]
          ).map((item) => (
            <TileOption
              key={item}
              label={item}
              selected={uma === item}
              onClick={() => setUma(item)}
            />
          ))}

          {uma === "その他" && (
            <div className="col-span-2 space-y-3 rounded-xl border-2 border-purple-300 bg-purple-50 p-3">
              <p className="font-bold text-purple-800">その他を選択中</p>

              <input
                value={customUmaFirst}
                onChange={(e) => setCustomUmaFirst(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="1位ウマを整数で入力"
                inputMode="numeric"
              />

              {!isThreePlayer && (
                <input
                  value={customUmaSecond}
                  onChange={(e) => setCustomUmaSecond(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  placeholder="2位ウマを整数で入力"
                  inputMode="numeric"
                />
              )}
            </div>
          )}
        </Section>

        <Section title="同点時ウマ折半" value={splitUma}>
          {["あり", "なし"].map((item) => (
            <TileOption
              key={item}
              label={item}
              selected={splitUma === item}
              onClick={() => setSplitUma(item)}
            />
          ))}
        </Section>

        <Section
          title="レート"
          value={rate === "その他" ? `${customRate || "未入力"}円` : rate}
        >
          {[
            "なし",
            "テンイチ",
            "テンニ",
            "テンサン",
            "テンヨン",
            "テンゴ",
            "テンピン",
            "その他",
          ].map((item) => (
            <TileOption
              key={item}
              label={item}
              selected={rate === item}
              onClick={() => setRate(item)}
            />
          ))}

          {rate === "その他" && (
            <div className="col-span-2 space-y-3 rounded-xl border-2 border-purple-300 bg-purple-50 p-3">
              <p className="font-bold text-purple-800">その他を選択中</p>

              <div className="flex items-center gap-2">
                <input
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border p-3"
                  placeholder="スコア1あたりの金額"
                  inputMode="numeric"
                />
                <span className="font-bold text-gray-600">円</span>
              </div>
            </div>
          )}
        </Section>

        <section className="rounded-xl bg-white p-4 shadow">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-8 w-2 bg-purple-700" />
            <h2 className="text-xl font-bold">箱下清算</h2>
            <span className="text-xl font-bold text-purple-700">
              {bankruptcy}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {["あり", "なし"].map((item) => (
              <TileOption
                key={item}
                label={item}
                selected={bankruptcy === item}
                onClick={() => setBankruptcy(item)}
              />
            ))}
          </div>
        </section>

        <Section title="場代" value={fee}>
          {["なし", "あり"].map((item) => (
            <TileOption
              key={item}
              label={item}
              selected={fee === item}
              onClick={() => setFee(item)}
            />
          ))}

          {fee === "あり" && (
            <div className="col-span-2 space-y-4 rounded-xl border-2 border-purple-300 bg-purple-50 p-3">
              <div>
                <label className="mb-1 block font-bold text-purple-800">
                  場代の合計金額
                </label>

                <input
                  value={feeTotal}
                  onChange={(e) => setFeeTotal(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  placeholder="9500"
                  inputMode="numeric"
                />
              </div>

              <button
                type="button"
                onClick={applyEvenFeeShare}
                className="w-full rounded-lg border-2 border-purple-700 bg-white py-2 font-bold text-purple-700"
              >
                合計金額を均等に割る
              </button>

              <div>
                <h3 className="mb-2 font-bold text-purple-800">
                  各メンバーの負担額
                </h3>

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
                        value={feeShares[String(player.id)] ?? ""}
                        onChange={(e) =>
                          setFeeShares({
                            ...feeShares,
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
                    isFeeShareCorrect
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  負担額合計：{feeShareTotal} / {feeTotalNumber}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-bold text-purple-800">
                  実際に払った金額
                </h3>

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
                        value={feePaids[String(player.id)] ?? ""}
                        onChange={(e) =>
                          setFeePaids({
                            ...feePaids,
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
                    isFeePaidCorrect
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  支払額合計：{feePaidTotal} / {feeTotalNumber}
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section title="チップ単価（1枚あたり）" value={getTipLabel(tip)}>
          {tipOptions.map((item) => (
            <TileOption
              key={item}
              label={getTipLabel(item)}
              selected={tip === item}
              onClick={() => setTip(item)}
            />
          ))}

          {tip === "その他" && (
            <div className="col-span-2 space-y-3 rounded-xl border-2 border-purple-300 bg-purple-50 p-3">
              <p className="font-bold text-purple-800">その他を選択中</p>

              <div className="flex items-center gap-2">
                <input
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border p-3"
                  placeholder="チップ1枚あたりの金額"
                  inputMode="numeric"
                />
                <span className="font-bold text-gray-600">円/1枚</span>
              </div>
            </div>
          )}
        </Section>

        <button
          onClick={validateAndSave}
          disabled={saving}
          className={`w-full rounded-xl py-4 text-lg font-bold text-white shadow-md ${
            saving ? "bg-gray-400" : "bg-purple-700"
          }`}
        >
          {saving ? "保存中..." : "保存"}
        </button>

        <button
          onClick={deleteMatch}
          className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold text-white shadow-md"
        >
          対戦を削除
        </button>
      </div>
    </main>
  );
}