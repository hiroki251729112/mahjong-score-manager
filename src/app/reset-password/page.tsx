"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const resetPassword = async () => {
    if (loading) return;

    if (!password || !confirmPassword) {
      alert("すべて入力してください");
      return;
    }

    if (password !== confirmPassword) {
      alert("パスワードが一致しません");
      return;
    }

    if (password.length < 6) {
      alert("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert("パスワード変更に失敗しました");
      console.error(error);
      setLoading(false);
      return;
    }

    alert("パスワードを変更しました");
    router.push("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 to-blue-200 p-6">
      <div className="w-full max-w-md rounded-3xl border border-purple-100 bg-white p-8 shadow-2xl">
        <div className="mb-4 text-center text-6xl">🀄</div>

        <h1 className="mb-3 text-center text-4xl font-bold text-purple-700">
          新しいパスワード
        </h1>

        <p className="mb-8 text-center text-sm text-gray-600">
          新しいパスワードを設定してください。
        </p>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block font-bold text-gray-700">
              新しいパスワード
            </label>

            <input
              type="password"
              placeholder="6文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-purple-200 bg-white px-5 py-4 text-gray-800 outline-none transition focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold text-gray-700">
              パスワード確認
            </label>

            <input
              type="password"
              placeholder="もう一度入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") resetPassword();
              }}
              className="w-full rounded-2xl border border-purple-200 bg-white px-5 py-4 text-gray-800 outline-none transition focus:border-purple-500"
            />
          </div>

          <button
            onClick={resetPassword}
            disabled={loading}
            className={`w-full rounded-2xl py-4 text-lg font-bold text-white shadow-md ${
              loading ? "bg-gray-400" : "bg-purple-700 hover:bg-purple-600"
            }`}
          >
            {loading ? "変更中..." : "パスワードを変更"}
          </button>

          <button
            onClick={() => router.push("/login")}
            className="block w-full pt-2 text-center font-bold text-purple-700 hover:underline"
          >
            ログイン画面へ戻る
          </button>
        </div>
      </div>
    </main>
  );
}