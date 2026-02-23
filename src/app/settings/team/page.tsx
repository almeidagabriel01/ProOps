import { redirect } from "next/navigation";

export default function LegacyTeamPageRedirect() {
  redirect("/team");
}
