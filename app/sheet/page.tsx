import { redirect } from "next/navigation";
import { DEFAULT_PACK_ID } from "@/lib/content/load";

/** 예전 단일 경로. 팩별 라우팅(`/learn/[packId]`) 으로 옮기며 리다이렉트만 남긴다. */
export default function SheetRedirectPage() {
  redirect(`/learn/${DEFAULT_PACK_ID}`);
}
