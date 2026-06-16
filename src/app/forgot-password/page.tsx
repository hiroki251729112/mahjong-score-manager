"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const sendResetEmail = async () => {
    if (loading) return;

    if (!email.trim()) {
      alert("メールアドレスを入力してください");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      alert("送信に失敗しました");
      console.error(error);
      setLoading(false);
      return;
    }

    alert("パスワード再設定メールを送信しました");
    router.push("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 to-blue-200 p-6">
      <div className="w-full max-w-md rounded-3xl border border-purple-100 bg-white p-8 shadow-2xl">
        <div className="mb-4 text-center text-6xl">🀄</div>

        <h1 className="mb-3 text-center text-4xl font-bold text-purple-700">
          パスワード再設定
        </h1>

        <p className="mb-8 text-center text-sm text-gray-600">
          登録済みメールアドレスに再設定リンクを送信します。
        </p>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block font-bold text-gray-700">
              メールアドレス
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") sendResetEmail();
              }}
              className="w-full rounded-2xl border border-purple-200 bg-white px-5 py-4 text-gray-800 outline-none transition focus:border-purple-500"
            />
          </div>

          <button
            onClick={sendResetEmail}
            disabled={loading}
            className={`w-full rounded-2xl py-4 text-lg font-bold text-white shadow-md ${
              loading ? "bg-gray-400" : "bg-purple-700 hover:bg-purple-600"
            }`}
          >
            {loading ? "送信中..." : "再設定メールを送信"}
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