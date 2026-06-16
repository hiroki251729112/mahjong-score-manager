"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Member = {
  id: number;
  name: string;
  color: string;
  user_id: string | null;
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

const colorPalette = [
  "#6d28d9",
  "#8b5cf6",
  "#c4b5fd",
  "#1d4ed8",
  "#3b82f6",
  "#93c5fd",
  "#0284c7",
  "#38bdf8",
  "#bae6fd",
  "#0891b2",
  "#22d3ee",
  "#a5f3fc",
  "#059669",
  "#34d399",
  "#a7f3d0",
  "#16a34a",
  "#4ade80",
  "#bbf7d0",
  "#65a30d",
  "#a3e635",
  "#d9f99d",
  "#ca8a04",
  "#facc15",
  "#fef08a",
  "#ea580c",
  "#fb923c",
  "#fed7aa",
  "#dc2626",
  "#f87171",
  "#fecaca",
  "#db2777",
  "#f472b6",
  "#fbcfe8",
  "#c026d3",
  "#e879f9",
  "#f5d0fe",
  "#92400e",
  "#b45309",
  "#d6b38a",
  "#374151",
  "#6b7280",
  "#cbd5e1",
  "#0f172a",
  "#334155",
  "#94a3b8",
  "#000000",
];

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

export default function CreateMatchPage() {
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);

  const [matchDate, setMatchDate] = useState("");

  const [matchType, setMatchType] = useState("4人麻雀");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([
    "",
    "",
    "",
    "",
  ]);

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

  const [feeTotal, setFeeTotal] = useState("");
  const [feeShares, setFeeShares] = useState<Record<string, string>>({});
  const [feePaids, setFeePaids] = useState<Record<string, string>>({});

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberTargetIndex, setAddMemberTargetIndex] = useState<
    number | null
  >(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberColor, setNewMemberColor] = useState(colorPalette[0]);

  const isThreePlayer = matchType === "3人麻雀";
  const playerCount = isThreePlayer ? 3 : 4;

  const selectedMembers = selectedMemberIds
    .slice(0, playerCount)
    .map((id) => members.find((member) => String(member.id) === id))
    .filter(Boolean) as Member[];

  const feeTotalNumber =
    feeTotal !== "" && /^\d+$/.test(feeTotal) ? Number(feeTotal) : 0;

  const feeShareTotal = selectedMembers.reduce((total, member) => {
    const value = feeShares[String(member.id)];
    return total + (value && /^\d+$/.test(value) ? Number(value) : 0);
  }, 0);

  const feePaidTotal = selectedMembers.reduce((total, member) => {
    const value = feePaids[String(member.id)];
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
    if (feeTotal === "" || !/^\d+$/.test(feeTotal)) return;

    const values = splitEvenly(Number(feeTotal), selectedMembers.length);
    const nextShares: Record<string, string> = {};

    selectedMembers.forEach((member, index) => {
      nextShares[String(member.id)] = String(values[index] ?? 0);
    });

    setFeeShares(nextShares);
  };

  const fetchMembers = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      alert("メンバーの取得に失敗しました");
      console.error(error);
      setLoadingMembers(false);
      return;
    }

    setMembers(data ?? []);
    setLoadingMembers(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    if (fee !== "あり") return;
    if (feeTotal === "" || !/^\d+$/.test(feeTotal)) return;
    if (selectedMembers.length !== playerCount) return;

    const values = splitEvenly(Number(feeTotal), selectedMembers.length);
    const nextShares: Record<string, string> = {};
    const nextPaids: Record<string, string> = {};

    selectedMembers.forEach((member, index) => {
      const key = String(member.id);

      nextShares[key] = feeShares[key] ?? String(values[index] ?? 0);
      nextPaids[key] = feePaids[key] ?? "0";
    });

    setFeeShares(nextShares);
    setFeePaids(nextPaids);
  }, [fee, feeTotal, selectedMemberIds.join(","), members.length]);

  const changeMatchType = (type: string) => {
    setMatchType(type);

    if (type === "3人麻雀") {
      setSelectedMemberIds((prev) => prev.slice(0, 3));
      setUma("10");
      setCustomUmaFirst("");
      setCustomUmaSecond("");
    } else {
      setSelectedMemberIds((prev) => {
        const next = [...prev];
        while (next.length < 4) next.push("");
        return next;
      });
      setUma("10-30");
      setCustomUmaFirst("");
      setCustomUmaSecond("");
    }
  };

  const changeSelectedMember = (index: number, value: string) => {
    const next = [...selectedMemberIds];

    if (value !== "" && next.includes(value)) {
      alert("同じメンバーは選択できません");
      return;
    }

    next[index] = value;
    setSelectedMemberIds(next);
  };

  const openAddMemberModal = (index: number) => {
    setAddMemberTargetIndex(index);
    setNewMemberName("");
    setNewMemberColor(colorPalette[0]);
    setShowAddMemberModal(true);
  };

  const addMemberFromModal = async () => {
    const name = newMemberName.trim();

    if (name === "") {
      alert("名前を入力してください");
      return;
    }

    const duplicate = members.some((member) => member.name === name);

    if (duplicate) {
      alert("同じ名前のメンバーが既に存在します");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("ログイン情報の取得に失敗しました");
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("members")
      .insert({
        name,
        color: newMemberColor,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      alert("メンバーの追加に失敗しました");
      console.error(error);
      return;
    }

    const addedMember = data as Member;

    setMembers((prev) =>
      [...prev, addedMember].sort((a, b) => a.name.localeCompare(b.name))
    );

    if (addMemberTargetIndex !== null) {
      const next = [...selectedMemberIds];
      next[addMemberTargetIndex] = String(addedMember.id);
      setSelectedMemberIds(next);
    }

    setShowAddMemberModal(false);
    setAddMemberTargetIndex(null);
    setNewMemberName("");
    setNewMemberColor(colorPalette[0]);
  };

  const validateAndSave = async () => {
    if (saving) return;


    if (matchDate === "") {
      alert("日付を選択してください");
      return;
    }

    const currentSelected = selectedMemberIds.slice(0, playerCount);

    if (currentSelected.some((id) => id === "")) {
      alert("参加メンバーを全員選択してください");
      return;
    }

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("ログイン情報の取得に失敗しました");
      setSaving(false);
      router.push("/login");
      return;
    }

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .insert({
        name: matchDate,
        match_date: matchDate,
        player_count: playerCount,
        start_point: startPointValue,
        return_point: returnPointValue,
        uma: umaValue,
        split_uma: splitUma,
        rate: rateValue,
        bankruptcy,
        fee,
        tip: tipValue,
        user_id: user.id,
      })
      .select()
      .single();

    if (matchError) {
      alert("対戦の保存に失敗しました");
      console.error(matchError);
      setSaving(false);
      return;
    }

    const matchId = matchData.id;

    const matchPlayers = currentSelected.map((memberId, index) => ({
      match_id: matchId,
      member_id: Number(memberId),
      seat_order: index + 1,
    }));

    const { error: playersError } = await supabase
      .from("match_players")
      .insert(matchPlayers);

    if (playersError) {
      alert("参加メンバーの保存に失敗しました");
      console.error(playersError);
      setSaving(false);
      return;
    }

    if (fee === "あり") {
      const matchFees = currentSelected.map((memberId) => ({
        match_id: matchId,
        member_id: Number(memberId),
        fee_share: Number(feeShares[memberId] ?? 0),
        fee_paid: Number(feePaids[memberId] ?? 0),
      }));

      const { error: feesError } = await supabase
        .from("match_fees")
        .insert(matchFees);

      if (feesError) {
        alert("場代情報の保存に失敗しました");
        console.error(feesError);
        setSaving(false);
        return;
      }
    }

    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <Link href="/" className="mb-4 inline-block text-sm text-purple-700">
        ← ホームへ戻る
      </Link>

      <h1 className="mb-6 text-2xl font-bold">新規対戦作成</h1>

      <div className="space-y-5">
        <section className="rounded-xl bg-white p-4 shadow">
          <div className="space-y-4">

            <div>
              <label className="mb-1 block font-bold">日付</label>
              <input
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                type="date"
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>
        </section>

        <Section title="人数" value={matchType}>
          {["4人麻雀", "3人麻雀"].map((item) => (
            <TileOption
              key={item}
              label={item}
              selected={matchType === item}
              onClick={() => changeMatchType(item)}
            />
          ))}
        </Section>

        <section className="rounded-xl bg-white p-4 shadow">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-8 w-2 bg-purple-700" />
            <h2 className="text-xl font-bold">参加メンバー</h2>
            <span className="text-xl font-bold text-purple-700">
              {selectedMembers.length}/{playerCount}人
            </span>
          </div>

          {loadingMembers ? (
            <p className="text-gray-500">メンバー読み込み中...</p>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: playerCount }).map((_, index) => {
                const selectedMember = members.find(
                  (member) => String(member.id) === selectedMemberIds[index]
                );

                return (
                  <div key={index}>
                    <label className="mb-1 block font-bold">
                      プレイヤー{index + 1}
                    </label>

                    <div className="flex items-center gap-2">
                      {selectedMember && (
                        <div
                          className="h-5 w-5 rounded-full border border-gray-300"
                          style={{ backgroundColor: selectedMember.color }}
                        />
                      )}

                      <select
                        value={selectedMemberIds[index] ?? ""}
                        onChange={(e) =>
                          changeSelectedMember(index, e.target.value)
                        }
                        className="min-w-0 flex-1 rounded-lg border p-3"
                      >
                        <option value="">選択してください</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => openAddMemberModal(index)}
                        className="rounded-lg bg-purple-700 px-4 py-3 font-bold text-white"
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                );
              })}

              {members.length === 0 && (
                <p className="text-sm text-gray-500">
                  登録済みメンバーがいません。＋ボタンから追加してください。
                </p>
              )}
            </div>
          )}
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

          <p className="mt-3 text-sm text-gray-600">
            {bankruptcy === "あり"
              ? "※箱下の場合でもそのままスコア計算を行います"
              : "※箱下の場合は0点持ちで終了した場合の処理を行います"}
          </p>
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
                  {selectedMembers.map((member) => (
                    <div key={member.id}>
                      <label className="mb-1 flex items-center gap-2 font-bold">
                        <span
                          className="h-4 w-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: member.color }}
                        />
                        {member.name}
                      </label>

                      <input
                        value={feeShares[String(member.id)] ?? ""}
                        onChange={(e) =>
                          setFeeShares({
                            ...feeShares,
                            [String(member.id)]: e.target.value,
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
                  {selectedMembers.map((member) => (
                    <div key={member.id}>
                      <label className="mb-1 flex items-center gap-2 font-bold">
                        <span
                          className="h-4 w-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: member.color }}
                        />
                        {member.name}
                      </label>

                      <input
                        value={feePaids[String(member.id)] ?? ""}
                        onChange={(e) =>
                          setFeePaids({
                            ...feePaids,
                            [String(member.id)]: e.target.value,
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
      </div>

      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-xl font-bold">新規メンバー追加</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block font-bold">名前</label>
                <input
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  placeholder="名前を入力"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">色</label>
                <div className="grid grid-cols-6 gap-3">
                  {colorPalette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewMemberColor(color)}
                      className={`flex h-10 items-center justify-center rounded-full border-4 transition-all ${
                        newMemberColor === color
                          ? "scale-105 border-purple-700"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {newMemberColor === color && (
                        <span className="text-xl font-bold text-white">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="rounded-xl border border-gray-300 bg-white py-3 font-bold"
                >
                  キャンセル
                </button>

                <button
                  type="button"
                  onClick={addMemberFromModal}
                  className="rounded-xl bg-purple-700 py-3 font-bold text-white"
                >
                  登録
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}