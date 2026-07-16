import type { CallResponse } from "../../types";

export function isVideoCall(call: CallResponse) {
  return call.media_kind === "video" || call.mime_type.toLowerCase().startsWith("video/");
}

export function mediaDownloadName(call: CallResponse) {
  const fallbackExtension = isVideoCall(call) ? ".mp4" : ".mp3";
  const rawName = call.original_filename || `${call.title || "call-media"}${fallbackExtension}`;
  return rawName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim() || `call-media${fallbackExtension}`;
}
