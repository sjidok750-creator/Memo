/** 브라우저에서 사진을 긴 변 기준으로 줄여 JPEG data URL 로 만든다 (업로드·토큰 절약) */
export async function fileToDataUrl(file: File, maxSide = 1600, quality = 0.86): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 넣을 수 있습니다.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // createImageBitmap 을 지원하지 않는 형식이면 원본 그대로
    return readAsDataUrl(file);
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return readAsDataUrl(file);
  ctx.fillStyle = "#fff"; // 투명 PNG 는 흰 배경으로
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
