const DEFAULT_MAX_EDGE = 1280;
const DEFAULT_QUALITY = 0.78;
const MIN_IMAGE_BYTES = 250 * 1024; // 250KB

const isCompressibleImage = (file: File) =>
  file.type.startsWith("image/") &&
  !/image\/(gif|svg\+xml|avif)/i.test(file.type);

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function getResizedDimensions(width: number, height: number, maxEdge: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function optimizeUploadImage(file: File, maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_QUALITY): Promise<File> {
  if (!isCompressibleImage(file)) return file;
  if (file.size < MIN_IMAGE_BYTES) return file;

  try {
    const img = await loadImageElement(file);
    const size = getResizedDimensions(img.naturalWidth, img.naturalHeight, maxEdge);

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, size.width, size.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });
    if (!blob) return file;
    if (blob.size >= file.size * 0.95) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}

