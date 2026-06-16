"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/");
        return;
      }

      setLoading(false);
    };

    checkSession();
  }, [router]);

  const login = async () => {
    if (loginLoading) return;

    if (!email.trim() || !password.trim()) {
      alert("メールアドレスとパスワードを入力してください");
      return;
    }

    setLoginLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      alert("ログインに失敗しました");
      console.error(error);
      setLoginLoading(false);
      return;
    }

    router.replace("/");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 to-blue-200 p-6">
        <p className="font-bold text-purple-700">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 to-blue-200 p-6">
      <div className="w-full max-w-md rounded-3xl border border-purple-100 bg-white p-8 shadow-2xl">
        <div className="mb-4 text-center text-6xl">🀄</div>

        <h1 className="mb-3 text-center text-4xl font-bold text-purple-700">
          麻雀成績管理
        </h1>

        <p className="mb-8 text-center text-sm text-gray-600">
          登録したメールアドレスとパスワードでログインしてください。
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
              className="w-full rounded-2xl border border-purple-200 bg-white px-5 py-4 text-gray-800 outline-none transition focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold text-gray-700">
              パスワード
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") login();
              }}
              placeholder="パスワード"
              className="w-full rounded-2xl border border-purple-200 bg-white px-5 py-4 text-gray-800 outline-none transition focus:border-purple-500"
            />
          </div>

          <button
            onClick={login}
            disabled={loginLoading}
            className={`w-full rounded-2xl py-4 text-lg font-bold text-white shadow-md ${
              loginLoading ? "bg-gray-400" : "bg-purple-700 hover:bg-purple-600"
            }`}
          >
            {loginLoading ? "ログイン中..." : "ログイン"}
          </button>

          <div className="space-y-3 pt-2 text-center">
            <button
              onClick={() => router.push("/signup")}
              className="block w-full font-bold text-purple-700 hover:underline"
            >
              アカウントを作成する
            </button>

            <button
              onClick={() => router.push("/forgot-password")}
              className="block w-full text-sm text-sky-600 hover:underline"
            >
              パスワードを忘れた場合
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}