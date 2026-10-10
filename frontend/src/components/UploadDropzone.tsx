import { useCallback, useId, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { optimizeUploadImage } from "../utils/imageUpload";

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
  const cameraInputId = `${inputId}-camera`;
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploading = activeUploads > 0;
  const supportsCameraCapture = useMemo(() => accept.includes("image"), [accept]);

  const upload = useCallback(
    async (file: File) => {
      setActiveUploads((c) => c + 1);
      setError(null);
      try {
        const optimizedFile = await optimizeUploadImage(file);
        const form = new FormData();
        form.append("file", optimizedFile);
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
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-lg border-[3px] border-dashed p-6 text-center transition ${
        dragOver ? "-translate-y-0.5 border-plate-yellow bg-steel-700" : "border-steel-600 bg-steel-900"
      } ${className ?? ""}`}
    >
      <input
        ref={galleryInputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={onPick}
      />
      {supportsCameraCapture && (
        <input
          ref={cameraInputRef}
          id={cameraInputId}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={false}
          className="hidden"
          onChange={onPick}
        />
      )}

      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`mx-auto mb-2 transition ${dragOver ? "text-plate-yellow -translate-y-1" : "text-steel-400"}`}>
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      <div className="text-steel-300">파일을 드래그해서 놓거나 버튼으로 선택하세요.</div>
      <div className="mt-1 text-sm text-steel-400">모바일 카메라 업로드 지원 · 이미지는 업로드 전 자동 압축됩니다.</div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="dg-btn dg-btn-steel px-3 py-2 text-sm"
          onClick={() => galleryInputRef.current?.click()}
        >
          갤러리에서 선택
        </button>
        {supportsCameraCapture && (
          <button
            type="button"
            className="dg-btn dg-btn-steel px-3 py-2 text-sm"
            onClick={() => cameraInputRef.current?.click()}
          >
            카메라로 촬영
          </button>
        )}
      </div>

      {uploading && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-steel-400" role="status">
          <span className="dg-loading-plates" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          업로드 중...
        </div>
      )}
      {error && <div className="mt-2 text-sm font-semibold text-red-400" role="alert">{error}</div>}
    </div>
  );
}
