"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { initialLoginState } from "@/app/actions/auth-state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState);
  return (
    <form action={formAction} className="login-form" noValidate>
      <div className="field-group">
        <label htmlFor="username">Demonstration username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          maxLength={80}
          required
        />
      </div>
      <div className="field-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={256}
          required
        />
      </div>
      <p className="form-error" role="status" aria-live="polite">
        {state.error ?? ""}
      </p>
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
