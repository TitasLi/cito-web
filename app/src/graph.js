// Microsoft Graph URL pagalbininkai (gryni, be tinklo).
export const GRAPH = "https://graph.microsoft.com/v1.0";

// Bendrinimo nuoroda -> Graph shares ID: "u!" + base64url(nuoroda) be '=' (Graph dokumentacija).
export function encodeShareUrl(url) {
  const bytes = new TextEncoder().encode(url);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = (typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64"));
  return "u!" + b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

export function resolveShareUrl(shareUrl) {
  return `${GRAPH}/shares/${encodeShareUrl(shareUrl)}/driveItem?$select=id,name,parentReference,webUrl`;
}

// Įkėlimas (iki 4 MB vienu PUT) į aplanką pagal drive ir item ID, failo vardu.
export function uploadUrl(driveId, folderItemId, fileName) {
  return `${GRAPH}/drives/${driveId}/items/${folderItemId}:/${encodeURIComponent(fileName)}:/content`;
}
