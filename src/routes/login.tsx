import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

import { BootScreen, Button, Field, Input } from "@/components/ui";
import { academyStatus, resolveLogin } from "@/lib/academy.fn";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

const BEARER_KEY = "grok-auth.bearer-token";

function captureSessionToken(ctx: { response: Response; data?: { token?: string | null } | null }) {
  const token = ctx.response.headers.get("set-auth-token") || ctx.data?.token || "";
  if (!token) return;
  try {
    sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* ignore */
  }
}

function authText(message?: string) {
  const msg = message ?? "";
  if (/exist/i.test(msg)) return "هذا البريد مستخدم بالفعل";
  if (/password/i.test(msg) || /short/i.test(msg)) return "كلمة المرور ٨ حروف على الأقل";
  if (/origin/i.test(msg)) return "تعذر الدخول من هذا العنوان";
  if (/email/i.test(msg)) return "البريد غير صالح";
  return "تعذر إتمام الطلب. تأكد من البيانات وحاول مرة أخرى.";
}

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let alive = true;
    academyStatus()
      .then((status) => {
        if (alive) setHasAdmin(status.hasAdmin);
      })
      .catch(() => {
        if (alive) setHasAdmin(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!mounted || isPending) return <BootScreen />;
  if (user) return <Navigate to="/" />;

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const resolved = await resolveLogin({ data: identifier.trim().toLowerCase() });
      if (!resolved.email) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة");
        return;
      }
      const result = await authClient.signIn.email({
        email: resolved.email,
        password,
        fetchOptions: { onSuccess: captureSessionToken },
      });
      if (result.error) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("تعذر تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  }

  async function onSignup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: signupPassword,
        fetchOptions: { onSuccess: captureSessionToken },
      });
      if (result.error) {
        setError(authText(result.error.message));
        return;
      }
      window.location.assign("/");
    } catch {
      setError("تعذر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-10">
      <div className="panel w-full max-w-md rounded-xl border border-line bg-card p-4">
        <p className="text-sm text-muted">تابعة للسويدي · امتحانات · درجات · حضور</p>
        <h1 className="mt-1 text-2xl font-semibold">مدرسة العالمين</h1>
        <p className="mt-2 text-sm text-muted">امتحانات، درجات، وحضور على كل الأجهزة.</p>
        <form className="mt-5 space-y-4" onSubmit={onLogin}>
          <Field label="اسم المستخدم أو البريد">
            <Input
              dir="ltr"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </Field>
          <Field label="كلمة المرور">
            <Input
              dir="ltr"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={busy}>
            دخول
          </Button>
        </form>
        {hasAdmin === false ? (
          <form className="mt-6 space-y-4 border-t border-line pt-5" onSubmit={onSignup}>
            <h2 className="text-lg font-semibold">أول حساب مدير</h2>
            <p className="text-sm text-muted">أول شخص يسجّل يصبح المدير، وبعدها ينشئ حسابات المدرسين والطلاب.</p>
            <Field label="الاسم">
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="البريد">
              <Input
                dir="ltr"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="كلمة المرور">
              <Input
                dir="ltr"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                required
              />
            </Field>
            <Button className="w-full" type="submit" variant="ghost" disabled={busy}>
              إنشاء حساب المدير
            </Button>
          </form>
        ) : (
          <p className="mt-5 text-sm text-muted">حسابات الطلاب والمدرسين يصدرها المدير من داخل المنصة.</p>
        )}
        <div className="mt-5 space-y-2 border-t border-line pt-5">
          {GROK_PROVIDERS.map((provider) => (
            <Button
              key={provider.providerId}
              className="w-full"
              variant="ghost"
              onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
            >
              المتابعة عبر {provider.label}
            </Button>
          ))}
        </div>
      </div>
    </main>
  );
}
