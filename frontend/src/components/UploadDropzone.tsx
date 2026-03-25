import { useCallback, useId, useState } from "react";
import { api } from "../lib/api";

type Props = {
  onUploaded?: (url: string) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  folder?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);

export default function UploadDropzone({
  onUploaded,
  accept = "image/*",
  multiple = false,
  className,
  folder = "gallery",
}: Props) {
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
        const res = await api.post("/api/files/upload", form, {
          params: { folder },
          headers: { "Content-Type": "multipart/form-data" },
        });
        const url = withBase(res.data.url);
        if (onUploaded) onUploaded(url);
      } catch (e: any) {
        const message =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "업로드에 실패했습니다.";
        setError(message);
      } finally {
        setActiveUploads((c) => Math.max(0, c - 1));
      }
    },
    [folder, onUploaded]
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      void upload(file);
    });
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
        dragOver ? "border-cyan-400 bg-cyan-500/10" : "border-gray-600 bg-gray-800/40"
      } ${className ?? ""}`}
    >
      <input id={inputId} type="file" accept={accept} multiple={multiple} className="hidden" onChange={onPick} />
      <label htmlFor={inputId} className="block cursor-pointer select-none">
        <div className="text-gray-300">파일을 드래그해서 놓거나 클릭해서 선택하세요.</div>
        <div className="mt-1 text-sm text-gray-500">이미지 업로드를 권장합니다.</div>
      </label>
      {uploading && <div className="mt-2 text-sm text-gray-400">업로드 중...</div>}
      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
    </div>
  );
}
