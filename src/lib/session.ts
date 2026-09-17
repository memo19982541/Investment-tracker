import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSpreadsheetId } from "./data";

export async function requireSession() {
  const session = await auth();
  if (!session || !session.accessToken) {
    redirect("/login");
  }
  if (session.error === "RefreshAccessTokenError") {
    redirect("/login");
  }
  return session;
}

export async function requireContext() {
  const session = await requireSession();
  const accessToken = session.accessToken!;
  const spreadsheetId = await getSpreadsheetId(accessToken);
  return { session, accessToken, spreadsheetId };
}
