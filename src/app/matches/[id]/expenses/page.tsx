"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

type MatchExpense = {
  id: number;
  match_id: number;
  member_id: number;
  expense_name: string;
  expense_share: number;
  expense_paid: number;
};

type ExpenseGroup = {
  name: string;
  rows: MatchExpense[];
};

type EditForm = {
  name: string;
  total: string;
  shares: Record<string, string>;
  paids: Record<string, string>;
};

function splitEvenly(total: number, count: number) {
  if (count <= 0) return [];

  const base = Math.floor(total / count);
  const remainder = total % count;

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

export default function ExpensesPage() {
  const params = useParams();
  const matchId = Number(params.id);

  const [players, setPlayers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<MatchExpense[]>([]);
  const [openName, setOpenName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async () => {
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

    const { data: expenseData, error: expenseError } = await supabase
      .from("match_expenses")
      .select("*")
      .eq("match_id", matchId)
      .order("id", { ascending: true });

    if (expenseError) {
      alert("支出の取得に失敗しました");
      console.error(expenseError);
      setLoading(false);
      return;
    }

    setPlayers(sortedPlayers);
    setExpenses((expenseData ?? []) as MatchExpense[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isNaN(matchId)) {
      fetchExpenses();
    }
  }, [matchId]);

  const expenseGroups: ExpenseGroup[] = Object.values(
    expenses.reduce<Record<string, ExpenseGroup>>((groups, expense) => {
      if (!groups[expense.expense_name]) {
        groups[expense.expense_name] = {
          name: expense.expense_name,
          rows: [],
        };
      }

      groups[expense.expense_name].rows.push(expense);
      return groups;
    }, {})
  );

  const getMemberName = (memberId: number) => {
    return players.find((player) => player.id === memberId)?.name ?? "";
  };

  const getGroupTotal = (group: ExpenseGroup) => {
    return group.rows.reduce((sum, row) => sum + row.expense_share, 0);
  };

  const openExpense = (group: ExpenseGroup) => {
    if (openName === group.name) {
      setOpenName(null);
      setEditForm(null);
      return;
    }

    const shares: Record<string, string> = {};
    const paids: Record<string, string> = {};

    group.rows.forEach((row) => {
      shares[String(row.member_id)] = String(row.expense_share);
      paids[String(row.member_id)] = String(row.expense_paid);
    });

    const total = getGroupTotal(group);

    setOpenName(group.name);
    setEditForm({
      name: group.name,
      total: String(total),
      shares,
      paids,
    });
  };

  const getTotalNumber = () => {
    if (!editForm) return 0;
    if (editForm.total === "" || !/^\d+$/.test(editForm.total)) return 0;
    return Number(editForm.total);
  };

  const getShareTotal = () => {
    if (!editForm) return 0;

    return players.reduce((total, player) => {
      const value = editForm.shares[String(player.id)];
      return total + (value && /^\d+$/.test(value) ? Number(value) : 0);
    }, 0);
  };

  const getPaidTotal = () => {
    if (!editForm) return 0;

    return players.reduce((total, player) => {
      const value = editForm.paids[String(player.id)];
      return total + (value && /^\d+$/.test(value) ? Number(value) : 0);
    }, 0);
  };

  const applyEvenShare = () => {
    if (!editForm) return;
    if (editForm.total === "" || !/^\d+$/.test(editForm.total)) return;

    const values = splitEvenly(Number(editForm.total), players.length);
    const nextShares: Record<string, string> = {};

    players.forEach((player, index) => {
      nextShares[String(player.id)] = String(values[index] ?? 0);
    });

    setEditForm({
      ...editForm,
      shares: nextShares,
    });
  };

  const deleteExpenseGroup = async (name: string) => {
    const ok = window.confirm(`${name} を削除しますか？`);

    if (!ok) return;

    const { error } = await supabase
      .from("match_expenses")
      .delete()
      .eq("match_id", matchId)
      .eq("expense_name", name);

    if (error) {
      alert("支出の削除に失敗しました");
      console.error(error);
      return;
    }

    if (openName === name) {
      setOpenName(null);
      setEditForm(null);
    }

    fetchExpenses();
  };

  const saveExpense = async (oldName: string) => {
    if (!editForm || saving) return;

    const name = editForm.name.trim();

    if (name === "") {
      alert("支出名を入力してください");
      return;
    }

    if (editForm.total === "" || !/^\d+$/.test(editForm.total)) {
      alert("合計金額を整数で入力してください");
      return;
    }

    const duplicateExpense = expenseGroups.some(
      (group) => group.name !== oldName && group.name === name
    );

    if (duplicateExpense) {
      alert("同じ名前の支出が既にあります");
      return;
    }

    const totalNumber = getTotalNumber();
    const shareTotal = getShareTotal();
    const paidTotal = getPaidTotal();

    if (shareTotal !== totalNumber) {
      alert("負担額の合計が合計金額と一致していません");
      return;
    }

    if (paidTotal !== totalNumber) {
      alert("支払額の合計が合計金額と一致していません");
      return;
    }

    setSaving(true);

    const { error: deleteError } = await supabase
      .from("match_expenses")
      .delete()
      .eq("match_id", matchId)
      .eq("expense_name", oldName);

    if (deleteError) {
      alert("支出の更新に失敗しました");
      console.error(deleteError);
      setSaving(false);
      return;
    }

    const insertRows = players.map((player) => ({
      match_id: matchId,
      member_id: player.id,
      expense_name: name,
      expense_share: Number(editForm.shares[String(player.id)] ?? 0),
      expense_paid: Number(editForm.paids[String(player.id)] ?? 0),
    }));

    const { error: insertError } = await supabase
      .from("match_expenses")
      .insert(insertRows);

    if (insertError) {
      alert("支出の更新に失敗しました");
      console.error(insertError);
      setSaving(false);
      return;
    }

    setOpenName(name);
    setSaving(false);
    await fetchExpenses();
  };

  return (
    <main className="min-h-screen bg-blue-50 p-4">
      <Link
        href={`/matches/${matchId}`}
        className="mb-4 inline-block text-sm text-purple-700"
      >
        ← 対戦詳細へ戻る
      </Link>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">支出管理</h1>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : expenseGroups.length === 0 ? (
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-gray-500">まだ支出は登録されていません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenseGroups.map((group) => {
            const isOpen = openName === group.name;
            const totalNumber = getTotalNumber();
            const shareTotal = getShareTotal();
            const paidTotal = getPaidTotal();
            const groupTotal = getGroupTotal(group);

            return (
              <div
                key={group.name}
                className="overflow-hidden rounded-xl bg-white shadow"
              >
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    onClick={() => openExpense(group)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold">{group.name}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        合計 {groupTotal.toLocaleString()}円
                      </div>
                    </div>

                    <span className="shrink-0 text-sm font-bold text-purple-700">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  <button
                    onClick={() => deleteExpenseGroup(group.name)}
                    className="shrink-0 rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white"
                  >
                    削除
                  </button>
                </div>

                {isOpen && editForm && (
                  <div className="border-t bg-purple-50 p-4">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block font-bold">支出名</label>

                        <input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              name: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border p-3"
                          placeholder="延長料金"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block font-bold">合計金額</label>

                        <input
                          value={editForm.total}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              total: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border p-3"
                          placeholder="2000"
                          inputMode="numeric"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={applyEvenShare}
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
                                {getMemberName(player.id)}
                              </label>

                              <input
                                value={editForm.shares[String(player.id)] ?? ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    shares: {
                                      ...editForm.shares,
                                      [String(player.id)]: e.target.value,
                                    },
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
                            shareTotal === totalNumber
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          負担額合計：{shareTotal} / {totalNumber}
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
                                {getMemberName(player.id)}
                              </label>

                              <input
                                value={editForm.paids[String(player.id)] ?? ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    paids: {
                                      ...editForm.paids,
                                      [String(player.id)]: e.target.value,
                                    },
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
                            paidTotal === totalNumber
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          支払額合計：{paidTotal} / {totalNumber}
                        </div>
                      </div>

                      <button
                        onClick={() => saveExpense(group.name)}
                        disabled={saving}
                        className={`w-full rounded-xl py-3 font-bold text-white ${
                          saving ? "bg-gray-400" : "bg-purple-700"
                        }`}
                      >
                        {saving ? "保存中..." : "変更を保存"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}