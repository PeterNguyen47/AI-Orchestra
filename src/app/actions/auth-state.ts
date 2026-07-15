export type LoginState = Readonly<{ error: string | null }>;
export const initialLoginState: LoginState = { error: null };
export const GENERIC_LOGIN_ERROR = "Invalid username or password.";
