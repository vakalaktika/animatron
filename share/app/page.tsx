import { redirect } from "next/navigation";
import { studioUrl } from "@/lib/config";

/** The root has nothing to show; the studio is where things are made. */
export default function Home() {
  redirect(studioUrl());
}
