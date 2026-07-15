import { logoutAction } from "@/app/actions/auth";

export function AppHeader({ username }: Readonly<{ username: string }>) {
  return (
    <header className="app-header">
      <a className="brand" href="/dashboard" aria-label="AI Orchestra dashboard">
        <span className="brand-mark" aria-hidden="true">
          AO
        </span>
        <span>
          <strong>AI Orchestra</strong>
          <small>Governed architecture composer</small>
        </span>
      </a>
      <div className="session-controls">
        <span className="stage-pill">Dashboard executable · Stage AO-004</span>
        <span className="signed-in">
          Signed in as <strong>{username}</strong>
        </span>
        <form action={logoutAction}>
          <button className="secondary-button" type="submit">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
