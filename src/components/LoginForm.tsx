"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { googleDirectLogin, linkGoogleAccount, login as loginUser, registerUser } from "@/services/accounts";
import { describeApiError } from "@/lib/api-errors";
import { safeReturnTo } from "@/lib/auth-return";

export const LoginForm = ({ returnTo = "/" }: { returnTo?: string }) => {
  const { login } = useAuth();
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleTokenToLink, setGoogleTokenToLink] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    if (register && password !== fields.get("confirm")) { setError("Passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      if (register) await registerUser({ name: String(fields.get("name") || "").trim(), email, password });
      const { data } = await loginUser({ email, password });
      login(data.user, data.access, data.refresh);
      if (googleTokenToLink) {
        try { await linkGoogleAccount({ id_token: googleTokenToLink, current_password: password }); }
        catch (err) { setError(describeApiError(err, "Signed in, but Google linking failed. Please try again.")); return; }
        finally { setGoogleTokenToLink(null); }
      }
      router.replace(safeReturnTo(returnTo));
    } catch (err) { setError(describeApiError(err, register ? "Could not create your account. If it was created, sign in to continue." : "Could not sign in. Check your email and password.")); }
    finally { setBusy(false); }
  };

  const handleGoogleLogin = async (idToken: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { data } = await googleDirectLogin({ id_token: idToken });
      login(data.user, data.access, data.refresh);
      router.replace(safeReturnTo(returnTo));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setRegister(false); setGoogleTokenToLink(idToken);
        setError("This email already has an account. Sign in with its password to link Google.");
      } else setError(describeApiError(err, "Google sign-in could not be completed. Please try again."));
    } finally { setBusy(false); }
  };

  return <div>
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {register && <label className="auth-label">Full name<input name="name" autoComplete="name" required className="auth-input" /></label>}
      <label className="auth-label">Email<input name="email" type="email" autoComplete="email" required className="auth-input" /></label>
      <label className="auth-label">Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required className="auth-input" /></label>
      {register && <label className="auth-label">Confirm password<input name="confirm" type="password" autoComplete="new-password" required className="auth-input" /></label>}
      <button type="submit" disabled={busy} className="primary-action w-full disabled:opacity-60">{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
    </form>
    {googleClientId && <div className="mt-4 flex h-11 items-center justify-center overflow-hidden"><GoogleOAuthProvider clientId={googleClientId}><GoogleLogin onSuccess={(response) => {
      if (response.credential) void handleGoogleLogin(response.credential);
      else setError("Google did not return a sign-in credential. Please try again.");
    }} onError={() => setError("Google sign-in could not be completed. Please try again.")} useOneTap /></GoogleOAuthProvider></div>}
    <button type="button" disabled={busy} onClick={() => { setRegister(!register); setError(null); }} className="mt-3 min-h-11 w-full text-sm text-neutral-600 underline">{register ? "Already have an account? Sign in" : "New to CBM TV? Create an account"}</button>
  </div>;
};
