import { redirect } from "next/navigation";

// The canonical "Dashboard" is the home page (/). Keep /dashboard as a safe redirect.
export default function DashboardPage() {
  redirect("/");
}

