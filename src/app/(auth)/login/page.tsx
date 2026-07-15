import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { verifySession } from "@/server/auth/authorization";

export default async function LoginPage() {
  if (await verifySession()) redirect("/dashboard");
  return (
    <main className="login-shell" id="main-content">
      <section className="login-intro" aria-labelledby="login-title">
        <p className="eyebrow">AI Orchestra · OpenAI Build Week 2026</p>
        <h1 id="login-title">Enter the governed demo workspace.</h1>
        <p>
          Use the local judge credentials created by <code>npm run demo:setup</code>. This seeded
          account is demonstration identity only, not a production authentication system.
        </p>
      </section>
      <section className="login-panel" aria-labelledby="form-title">
        <div>
          <p className="panel-kicker">Protected demonstration</p>
          <h2 id="form-title">Sign in</h2>
        </div>
        <LoginForm />
        <p className="login-help">
          Credentials stay in ignored local files. Authentication is handled by the server and the
          session is stored only in an HttpOnly cookie.
        </p>
      </section>
    </main>
  );
}
