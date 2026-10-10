import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import UploadDropzone from "../../components/UploadDropzone";
import { api } from "../../lib/api";
import { eventApi } from "../../services/eventApi";
import type { EventStatus } from "../../types/event";

type Props = { mode: "create" | "edit" };

type FormState = {
  title: string;
  summary: string;
  content: string;
  thumbnailUrl: string;
  bannerUrl: string;
  startAt: string;
  endAt: string;
  status: EventStatus;
  isMainBanner: boolean;
  isPinned: boolean;
  priority: number;
  ctaText: string;
  ctaLink: string;
  tagsText: string;
};

const STATUS_OPTIONS: EventStatus[] = ["DRAFT", "SCHEDULED", "ACTIVE", "ENDED", "HIDDEN"];
// 값은 그대로, 화면 라벨만 사람이 읽는 말로
const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "작성 중",
  SCHEDULED: "예약",
  ACTIVE: "진행 중",
  ENDED: "종료",
  HIDDEN: "숨김",
};
const FIELD = "rounded-md border-2 border-black bg-steel-900 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow p-2.5";

const initialForm: FormState = {
  title: "",
  summary: "",
  content: "",
  thumbnailUrl: "",
  bannerUrl: "",
  startAt: "",
  endAt: "",
  status: "DRAFT",
  isMainBanner: false,
  isPinned: false,
  priority: 0,
  ctaText: "자세히 보기",
  ctaLink: "",
  tagsText: "",
};

export default function AdminEventForm({ mode }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === "edit";

  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [library, setLibrary] = useState<string[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");

  const pageTitle = useMemo(() => (isEdit ? "이벤트 수정" : "이벤트 생성"), [isEdit]);

  const loadLibrary = async () => {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const res = await api.get<string[]>("/api/files/list", { params: { folder: "events" } });
      setLibrary(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setLibraryError(e?.response?.data?.message || "업로드 파일 목록을 불러오지 못했습니다.");
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!isEdit || !id) return;
      setLoading(true);
      setError("");
      try {
        const detail = await eventApi.getAdminDetail(Number(id));
        setForm({
          title: detail.title,
          summary: detail.summary,
          content: detail.content,
          thumbnailUrl: detail.thumbnailUrl,
          bannerUrl: detail.bannerUrl || "",
          startAt: detail.startAt.slice(0, 16),
          endAt: detail.endAt.slice(0, 16),
          status: detail.status,
          isMainBanner: detail.isMainBanner,
          isPinned: detail.isPinned,
          priority: detail.priority,
          ctaText: detail.ctaText,
          ctaLink: detail.ctaLink,
          tagsText: detail.tags.join(", "),
        });
      } catch (e: any) {
        setError(e?.response?.data?.message || "상세 조회에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id, isEdit]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        content: form.content,
        thumbnailUrl: form.thumbnailUrl,
        bannerUrl: form.bannerUrl || undefined,
        startAt: form.startAt,
        endAt: form.endAt,
        status: form.status,
        isMainBanner: form.isMainBanner,
        isPinned: form.isPinned,
        priority: Number(form.priority),
        ctaText: form.ctaText,
        ctaLink: form.ctaLink,
        tags: form.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      };

      if (isEdit && id) {
        await eventApi.update(Number(id), payload);
      } else {
        await eventApi.create(payload);
      }
      navigate("/admin/events");
    } catch (e: any) {
      setError(e?.response?.data?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const filteredLibrary = library.filter((url) => {
    if (!libraryQuery.trim()) return true;
    return url.toLowerCase().includes(libraryQuery.trim().toLowerCase());
  });

  if (loading)
    return (
      <section className="flex min-h-screen items-start justify-center gap-3 px-6 pt-32 text-steel-400" role="status">
        <span className="dg-loading-plates" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        불러오는 중...
      </section>
    );

  return (
    <section className="min-h-screen pt-28 pb-24 text-chalk">
      <div className="mx-auto max-w-3xl space-y-6 px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-plate-yellow">
              이벤트 관리 <span className="font-num text-xs tracking-wide text-steel-500">ADMIN</span>
            </p>
            <h1 className="text-3xl">{pageTitle}</h1>
          </div>
        </div>
        {error && <p className="rounded-md border-2 border-l-[6px] border-black border-l-plate-red bg-steel-900 p-3 text-red-200" role="alert">{error}</p>}

        <form onSubmit={submit} className="dg-steel dg-rise space-y-4 p-5 md:p-6">
          <input className={`w-full ${FIELD}`} placeholder="제목" aria-label="제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className={`w-full ${FIELD}`} placeholder="요약" aria-label="요약" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} required />
          <textarea className={`h-48 w-full ${FIELD}`} placeholder="본문 (HTML)" aria-label="본문" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />

          <div className="dg-well space-y-3 p-4">
            <p className="text-sm font-semibold text-plate-yellow">썸네일 이미지</p>
            <UploadDropzone folder="events" accept="image/*" onUploaded={(url) => { setForm((prev) => ({ ...prev, thumbnailUrl: url })); void loadLibrary(); }} />
            <input className={`w-full ${FIELD}`} placeholder="썸네일 이미지 주소" aria-label="썸네일 이미지 주소" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} required />
            {form.thumbnailUrl && <img src={form.thumbnailUrl} alt="썸네일 미리보기" className="dg-pop h-40 w-full rounded-md border-2 border-black object-cover" />}
          </div>

          <div className="dg-well space-y-3 p-4">
            <p className="text-sm font-semibold text-plate-yellow">배너 이미지 (선택)</p>
            <UploadDropzone folder="events" accept="image/*" onUploaded={(url) => { setForm((prev) => ({ ...prev, bannerUrl: url })); void loadLibrary(); }} />
            <input className={`w-full ${FIELD}`} placeholder="배너 이미지 주소 (선택)" aria-label="배너 이미지 주소" value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} />
            {form.bannerUrl && <img src={form.bannerUrl} alt="배너 미리보기" className="dg-pop h-40 w-full rounded-md border-2 border-black object-cover" />}
          </div>

          <div className="dg-well space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-plate-yellow">업로드 파일 찾기</p>
              <button type="button" onClick={() => void loadLibrary()} className="dg-btn dg-btn-steel px-3 py-1 text-xs">새로고침</button>
            </div>
            <input className={`w-full ${FIELD}`} placeholder="파일명/경로 검색" aria-label="업로드 파일 검색" value={libraryQuery} onChange={(e) => setLibraryQuery(e.target.value)} />
            {libraryLoading && (
              <p className="flex items-center gap-2 text-sm text-steel-300" role="status">
                <span className="dg-loading-plates" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                파일 목록 로딩 중...
              </p>
            )}
            {libraryError && <p className="text-sm text-red-300">{libraryError}</p>}
            {!libraryLoading && filteredLibrary.length === 0 && <p className="text-sm text-gray-400">검색 결과가 없습니다.</p>}
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
              {filteredLibrary.map((url) => (
                <div
                  key={url}
                  className={`overflow-hidden rounded-md border-2 bg-steel-800 p-2 transition hover:-translate-y-0.5 hover:shadow-md ${
                    form.thumbnailUrl === url || form.bannerUrl === url ? "border-plate-yellow" : "border-black"
                  }`}
                >
                  <img src={url} alt="업로드 이미지" className="h-24 w-full rounded object-cover" />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, thumbnailUrl: url }))} className="dg-btn dg-btn-primary px-2 py-1 text-xs">썸네일 선택</button>
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, bannerUrl: url }))} className="dg-btn dg-btn-steel px-2 py-1 text-xs">배너 선택</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input type="datetime-local" aria-label="시작 일시" className={FIELD} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required />
            <input type="datetime-local" aria-label="종료 일시" className={FIELD} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select aria-label="상태" className={FIELD} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}>
              {STATUS_OPTIONS.map((status) => (<option key={status} value={status}>{STATUS_LABEL[status]}</option>))}
            </select>
            <input type="number" aria-label="우선순위" placeholder="우선순위" className={`${FIELD} font-num text-base`} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            <input className={FIELD} placeholder="태그 (쉼표로 구분)" aria-label="태그" value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input className={FIELD} placeholder="버튼 문구" aria-label="버튼 문구" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} required />
            <input className={FIELD} placeholder="버튼 링크" aria-label="버튼 링크" value={form.ctaLink} onChange={(e) => setForm({ ...form, ctaLink: e.target.value })} required />
          </div>

          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-steel-200"><input type="checkbox" className="h-4 w-4 accent-plate-red" checked={form.isMainBanner} onChange={(e) => setForm({ ...form, isMainBanner: e.target.checked })} /><span>메인배너 노출</span></label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-steel-200"><input type="checkbox" className="h-4 w-4 accent-plate-red" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} /><span>핀 고정</span></label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="dg-btn dg-btn-primary px-5 py-2">{saving ? "저장 중..." : "저장"}</button>
            <button type="button" onClick={() => navigate("/admin/events")} className="dg-btn dg-btn-steel px-4 py-2">취소</button>
          </div>
        </form>
      </div>
    </section>
  );
}
