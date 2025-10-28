import { useCallback, useState } from "react";

type Props = {
  onUploaded?: (url: string) => void;
  accept?: string;
};

export default function UploadDropzone({ onUploaded, accept = "image/*" }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/files/upload`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (onUploaded) onUploaded(data.url);
    } catch (e: any) {
      setError(e?.message || "업로드 실패");
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
        dragOver ? "border-pink-500 bg-pink-500/10" : "border-gray-600 bg-gray-800/40"
      }`}
    >
      <input type="file" accept={accept} className="hidden" id="file-input__uploader" onChange={onPick} />
      <label htmlFor="file-input__uploader" className="block cursor-pointer select-none">
        <div className="text-gray-300">이미지를 드래그 앤 드롭하거나 클릭하여 선택하세요</div>
        <div className="text-sm text-gray-500 mt-1">PNG, JPG 등 (최대 10MB 권장)</div>
      </label>
      {uploading && <div className="text-sm text-gray-400 mt-2">업로드 중...</div>}
      {error && <div className="text-sm text-red-400 mt-2">{error}</div>}
    </div>
  );
}

