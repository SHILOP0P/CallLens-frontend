import type { AppPage } from "../types";
import { pageRoutes } from "./runtime";

export function callIdFromLocation() {
  return new URLSearchParams(window.location.search).get("call") ?? "";
}

export function pageUrl(page: AppPage, callId: string) {
  const base = pageRoutes[page];
  return (page === "calls" || page === "analysis" || page === "transcriptionEdit" || page === "transcriptionCompare") && callId
    ? `${base}?call=${encodeURIComponent(callId)}`
    : base;
}
