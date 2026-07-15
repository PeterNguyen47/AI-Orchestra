import { redirect } from "next/navigation";
import { verifySession } from "@/server/auth/authorization";

export default async function Home() {
  redirect((await verifySession()) ? "/dashboard" : "/login");
}
