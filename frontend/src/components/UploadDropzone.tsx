import { useCallback, useId, useState } from "react";

type Props = {
  onUploaded?: (url: string) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);

export default function UploadDropzone({ onUploaded, accept = "image/*", multiple = false, className }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [activeUploads, setActiveUploads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const uploading = activeUploads > 0;

  const upload = useCallback(
    async (file: File) => {
      setActiveUploads((c) => c + 1);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/files/upload`, {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const url = withBase(data.url);
        if (onUploaded) onUploaded(url);
      } catch (e: any) {
        setError(e?.message || "업로드에 실패했어요");
      } finally {
        setActiveUploads((c) => Math.max(0, c - 1));
      }
    },
    [onUploaded]
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => upload(f));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
        dragOver ? "border-pink-500 bg-pink-500/10" : "border-gray-600 bg-gray-800/40"
      } ${className ?? ""}`}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        id={inputId}
        onChange={onPick}
      />
      <label htmlFor={inputId} className="block cursor-pointer select-none">
        <div className="text-gray-300">사진/영상은 드래그하거나 터치해서 올릴 수 있어요.</div>
        <div className="text-sm text-gray-500 mt-1">PNG, JPG, MP4 등 (최대 10MB 권장)</div>
      </label>
      {uploading && <div className="text-sm text-gray-400 mt-2">업로드 중...</div>}
      {error && <div className="text-sm text-red-400 mt-2">{error}</div>}
    </div>
  );
}
