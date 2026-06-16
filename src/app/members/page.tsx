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

const colorPalette = [
  "#6d28d9", "#8b5cf6", "#c4b5fd",
  "#1d4ed8", "#3b82f6", "#93c5fd",
  "#0284c7", "#38bdf8", "#bae6fd",
  "#0891b2", "#22d3ee", "#a5f3fc",
  "#059669", "#34d399", "#a7f3d0",
  "#16a34a", "#4ade80", "#bbf7d0",
  "#65a30d", "#a3e635", "#d9f99d",
  "#ca8a04", "#facc15", "#fef08a",
  "#ea580c", "#fb923c", "#fed7aa",
  "#dc2626", "#f87171", "#fecaca",
  "#db2777", "#f472b6", "#fbcfe8",
  "#c026d3", "#e879f9", "#f5d0fe",
  "#92400e", "#b45309", "#d6b38a",
  "#374151", "#6b7280", "#cbd5e1",
  "#0f172a", "#334155", "#94a3b8",
  "#000000",
];

export default function MembersPage() {
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(colorPalette[0]);

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(colorPalette[0]);

  const fetchLoginUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      router.push("/login");
      return null;
    }

    return user;
  };

  const fetchMembers = async () => {
    const user = await fetchLoginUser();

    if (!user) {
      setLoading(false);
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
      setLoading(false);
      return;
    }

    setMembers(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const isDuplicateName = (name: string, ignoreId?: number) => {
    return members.some(
      (member) => member.name === name.trim() && member.id !== ignoreId
    );
  };

  const addMember = async () => {
    const name = newName.trim();

    if (name === "") {
      alert("名前を入力してください");
      return;
    }

    if (isDuplicateName(name)) {
      alert("同じ名前のメンバーが既に存在します");
      return;
    }

    const user = await fetchLoginUser();

    if (!user) return;

    const { error } = await supabase.from("members").insert({
      name,
      color: newColor,
      user_id: user.id,
    });

    if (error) {
      alert("メンバーの追加に失敗しました");
      console.error(error);
      return;
    }

    setNewName("");
    setNewColor(colorPalette[0]);
    setShowAdd(false);
    fetchMembers();
  };

  const startEdit = (member: Member) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditColor(member.color);
    setShowAdd(false);
  };

  const updateMember = async () => {
    if (!editingMember) return;

    const name = editName.trim();

    if (name === "") {
      alert("名前を入力してください");
      return;
    }

    if (isDuplicateName(name, editingMember.id)) {
      alert("同じ名前のメンバーが既に存在します");
      return;
    }

    const user = await fetchLoginUser();

    if (!user) return;

    const { error } = await supabase
      .from("members")
      .update({
        name,
        color: editColor,
      })
      .eq("id", editingMember.id)
      .eq("user_id", user.id);

    if (error) {
      alert("メンバーの更新に失敗しました");
      console.error(error);
      return;
    }

    setEditingMember(null);
    fetchMembers();
  };

  const deleteMember = async (member: Member) => {
    const result = window.confirm(`${member.name} を削除しますか？`);

    if (!result) return;

    const user = await fetchLoginUser();

    if (!user) return;

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", member.id)
      .eq("user_id", user.id);

    if (error) {
      alert("メンバーの削除に失敗しました");
      console.error(error);
      return;
    }

    fetchMembers();
  };

  const ColorPalette = ({
    selectedColor,
    onSelect,
  }: {
    selectedColor: string;
    onSelect: (color: string) => void;
  }) => {
    return (
      <div className="grid grid-cols-6 gap-3">
        {colorPalette.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            className={`flex h-10 items-center justify-center rounded-full border-4 transition-all ${
              selectedColor === color
                ? "scale-105 border-purple-700"
                : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
          >
            {selectedColor === color && (
              <span className="text-xl font-bold text-white">✓</span>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <Link href="/" className="mb-4 inline-block text-sm text-purple-700">
        ← ホームへ戻る
      </Link>

      <h1 className="mb-6 text-2xl font-bold">メンバー管理</h1>

      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <div className="space-y-3">
          {members.length === 0 && (
            <div className="rounded-xl bg-white p-4 text-gray-500 shadow">
              メンバーが登録されていません
            </div>
          )}

          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-5 w-5 rounded-full border border-gray-300"
                  style={{ backgroundColor: member.color }}
                />

                <span className="font-bold">{member.name}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(member)}
                  className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-bold text-white"
                >
                  編集
                </button>

                <button
                  onClick={() => deleteMember(member)}
                  className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          setShowAdd(!showAdd);
          setEditingMember(null);
        }}
        className="mt-6 w-full rounded-xl bg-purple-700 py-3 font-bold text-white"
      >
        ＋ メンバー追加
      </button>

      {showAdd && (
        <div className="mt-4 rounded-xl bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-bold">メンバー追加</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-bold">名前</label>

              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="名前を入力"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold">色</label>

              <p className="mb-2 text-sm text-gray-500">
                選択した色は対局結果やランキングで使用されます
              </p>

              <ColorPalette selectedColor={newColor} onSelect={setNewColor} />
            </div>

            <button
              onClick={addMember}
              className="w-full rounded-xl bg-purple-700 py-4 text-lg font-bold text-white shadow-md"
            >
              登録
            </button>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="mt-4 rounded-xl bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-bold">メンバー編集</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-bold">名前</label>

              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="名前を入力"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold">色</label>

              <ColorPalette selectedColor={editColor} onSelect={setEditColor} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setEditingMember(null)}
                className="rounded-xl border border-gray-300 bg-white py-3 font-bold"
              >
                キャンセル
              </button>

              <button
                onClick={updateMember}
                className="rounded-xl bg-purple-700 py-3 font-bold text-white"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}