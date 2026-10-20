import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DialogFrame from "../components/DialogFrame";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import MobSprite from "../components/dungeon/MobSprite";
import type { CharacterTier, GrowthParams } from "../components/avatar/types";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";
import {
  CATEGORY_LABEL,
  COLLECTION_PATH,
  RARITY_CLASS,
  RARITY_LABEL,
  frameClass,
  syncEquippedTank,
  type CollectionCategory,
  type CollectionItemView,
  type CollectionView,
  type Equipped,
  type OpenResult,
} from "../lib/collection";

// 도감(모으는 재미) + 보상 상자(의외의 보상).
// 상자: 주간 목표를 채우면 확정, 운동한 날 20% 확률, 처음 오면 하나. 열면 칭호 · 민소매 색 · 카드 테두리 중 하나(같은 게 나오면 조각).
// 장착한 것은 지금 내 화면(캐릭터 카드 · 홈 · 내 아바타)에만 보인다.

type MyCharacter = {
  avatarSeed: string;
  tier: CharacterTier;
  evolutionStage: number;
  growthParams?: GrowthParams | null;
  bodyStage?: number | null;
  gender?: "MALE" | "FEMALE" | null;
};

const CATEGORIES: CollectionCategory[] = ["TITLE", "TANK", "FRAME", "MONSTER"];

function ItemPreview({ item, size = "md" }: { item: Pick<CollectionItemView, "category" | "value" | "label">; size?: "md" | "lg" }) {
  if (item.category === "TITLE") {
    return (
      <span className={`dg-chip inline-block max-w-full truncate font-display ${size === "lg" ? "px-4 py-2 text-2xl" : "text-base"}`}>
        {item.value}
      </span>
    );
  }
  if (item.category === "TANK") {
    return (
      <span
        aria-hidden="true"
        className={`inline-block rounded-md border-[3px] border-steel-950 ${size === "lg" ? "h-20 w-16" : "h-12 w-10"}`}
        style={{ backgroundColor: item.value, clipPath: "polygon(22% 0, 38% 0, 42% 14%, 58% 14%, 62% 0, 78% 0, 82% 26%, 82% 100%, 18% 100%, 18% 26%)" }}
      />
    );
  }
  if (item.category === "MONSTER") {
    // 던전 잡몹 픽셀 그림(지도 · 전투 창과 같은 그림)
    return <MobSprite code={item.value} size={size === "lg" ? 112 : 64} />;
  }
  return (
    <span className={`block p-3 ${size === "lg" ? "w-40" : "w-full"}`}>
      <span aria-hidden="true" className={`dg-frame-swatch block ${frameClass(item.value)}`} />
    </span>
  );
}

export default function Collection() {
  const [view, setView] = useState<CollectionView | null>(null);
  /** 민소매를 갈아입을 때마다 1씩 — 내 모습이 한 바퀴 도는 장면을 다시 튼다 */
  const [turn, setTurn] = useState(0);
  const [character, setCharacter] = useState<MyCharacter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CollectionCategory>("TITLE");
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState<OpenResult | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [viewRes, characterRes] = await Promise.all([
        api.get<CollectionView>(COLLECTION_PATH),
        api.get<MyCharacter>("/api/character/me").catch(() => null),
      ]);
      const v = viewRes.data;
      setView(v);
      setError(null);
      const ch = characterRes?.data ?? null;
      setCharacter(ch);
      syncEquippedTank(ch?.avatarSeed, v.equipped.tank);
      if (v.welcomeBox) toast("도감에 온 걸 환영해요! 보상 상자 하나를 드렸어요.", "success");
      if (v.newlyUnlocked.length > 0) toast(`새로 모았어요: ${v.newlyUnlocked.join(", ")}`, "success");
    } catch (e: unknown) {
      setError(friendlyError(e, "도감을 불러오지 못했어요."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyEquipped = (equipped: Equipped) => {
    // 민소매가 바뀌면 내 모습이 한 바퀴 돌며 갈아입는다
    if ((view?.equipped.tank ?? null) !== (equipped.tank ?? null)) setTurn((n) => n + 1);
    setView((v) => (v ? { ...v, equipped } : v));
    syncEquippedTank(character?.avatarSeed, equipped.tank);
  };

  const openBox = async () => {
    if (!view || opening || view.boxes <= 0) return;
    setOpening(true);
    setOpened(null);
    try {
      const [res] = await Promise.all([
        api.post<OpenResult>("/api/collection/boxes/open"),
        new Promise((r) => window.setTimeout(r, 560)), // 상자가 흔들리는 동안
      ]);
      const r = res.data;
      setOpened(r);
      setView((v) =>
        v
          ? {
              ...v,
              boxes: r.boxes,
              shards: r.shards,
              boxesOpened: v.boxesOpened + 1,
              owned: r.duplicate ? v.owned : v.owned + 1,
              items: r.duplicate ? v.items : v.items.map((i) => (i.code === r.item.code ? { ...i, owned: true } : i)),
            }
          : v,
      );
    } catch (e: unknown) {
      toast(friendlyError(e, "상자를 열지 못했어요."), "error");
    } finally {
      setOpening(false);
    }
  };

  const equip = async (category: CollectionCategory, code: string | null) => {
    setBusyCode(code ?? category);
    try {
      const res = await api.put<Equipped>("/api/collection/equip", { category, code });
      applyEquipped(res.data);
      toast(code ? "장착했어요." : "뺐어요.", "success");
    } catch (e: unknown) {
      toast(friendlyError(e, "장착하지 못했어요."), "error");
    } finally {
      setBusyCode(null);
    }
  };

  const craft = async (item: CollectionItemView) => {
    if (!window.confirm(`조각 ${item.craftCost}개로 "${item.label}"을(를) 만들까요?`)) return;
    setBusyCode(item.code);
    try {
      await api.post("/api/collection/craft", { code: item.code });
      toast(`"${item.label}"을(를) 만들었어요!`, "success");
      setView((v) =>
        v
          ? {
              ...v,
              shards: v.shards - (item.craftCost ?? 0),
              owned: v.owned + 1,
              items: v.items.map((i) => (i.code === item.code ? { ...i, owned: true, isNew: true } : i)),
            }
          : v,
      );
    } catch (e: unknown) {
      toast(friendlyError(e, "만들지 못했어요."), "error");
    } finally {
      setBusyCode(null);
    }
  };

  const equippedCode = (cat: CollectionCategory) =>
    !view || cat === "MONSTER" ? null : cat === "TITLE" ? view.equipped.titleCode : cat === "TANK" ? view.equipped.tankCode : view.equipped.frameCode;

  if (error) {
    return (
      <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto max-w-2xl space-y-3">
          <p className="dg-steel p-4 text-sm text-red-300">{error}</p>
          <button type="button" onClick={() => void load()} className="dg-btn dg-btn-steel min-h-[44px] px-4">
            다시 불러오기
          </button>
        </div>
      </section>
    );
  }

  if (!view) {
    return (
      <section className="min-h-screen px-4 pb-20 pt-28 text-white">
        <div className="dg-loading-plates mx-auto mt-10" role="status" aria-label="도감 불러오는 중" />
      </section>
    );
  }

  const items = view.items.filter((i) => i.category === tab);
  const ownedIn = (cat: CollectionCategory) => view.items.filter((i) => i.category === cat && i.owned).length;
  const totalIn = (cat: CollectionCategory) => view.items.filter((i) => i.category === cat).length;

  return (
    <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="space-y-1">
          <p className="text-sm font-bold text-plate-yellow">도감</p>
          <h1 className="text-3xl">모으는 재미</h1>
          <p className="text-sm text-steel-400">
            모은 것 <span className="font-num text-lg text-white">{view.owned}</span>/{view.total} · 조각{" "}
            <span className="font-num text-lg text-white">{view.shards}</span> · 활동 <span className="font-num text-white">Lv.{view.activity.level}</span>
          </p>
        </header>

        {/* 내 모습 + 보상 상자 */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className={`dg-steel flex items-center gap-4 p-4 ${frameClass(view.equipped.frame)}`}>
            <div className="dg-rubber relative flex h-[150px] w-[120px] flex-none items-end justify-center overflow-hidden rounded-lg border-[3px] border-black">
              <div aria-hidden="true" className="dg-platform absolute inset-x-0 bottom-0 h-6" />
              {character && (
                <div key={turn} className={`relative z-[1] mb-5 ${turn ? "pxa-turn" : ""}`}>
                  <AvatarRenderer
                    avatarSeed={character.avatarSeed}
                    tier={character.tier}
                    stage={character.evolutionStage}
                    growthParams={character.growthParams}
                    bodyStage={character.bodyStage}
                    gender={character.gender}
                    tank={view.equipped.tank}
                    size={104}
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-2 text-sm">
              <p className="text-xs text-steel-400">지금 장착</p>
              <p className="truncate">
                <span className="text-steel-400">칭호 </span>
                {view.equipped.title ? <strong className="font-display text-lg">{view.equipped.title}</strong> : "없음"}
              </p>
              <p className="text-steel-400">민소매 · 테두리는 내 캐릭터 카드에 보여요.</p>
            </div>
          </div>

          <div className="dg-steel flex items-center gap-4 p-4">
            <div className="flex flex-none flex-col items-center gap-2">
              <span className={`dg-reward-box ${view.boxes <= 0 ? "is-empty" : ""} ${opening ? "dg-box-shake" : ""}`} aria-hidden="true" />
              <span className="font-num text-2xl">× {view.boxes}</span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="font-display text-xl">보상 상자</h2>
              <p className="text-xs text-steel-400">주간 목표를 채우면 확정, 운동한 날엔 20% 확률로 생겨요. 같은 게 나오면 조각이 돼요.</p>
              <button
                type="button"
                onClick={() => void openBox()}
                disabled={opening || view.boxes <= 0}
                className="dg-btn dg-btn-primary min-h-[48px] w-full text-base"
              >
                {opening ? "여는 중..." : view.boxes > 0 ? "상자 열기" : "상자가 없어요"}
              </button>
            </div>
          </div>
        </div>

        {/* 칸 */}
        <div className="flex gap-2" role="tablist" aria-label="도감 종류">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={tab === cat}
              onClick={() => setTab(cat)}
              className={`dg-btn min-h-[44px] flex-1 px-2 text-sm ${tab === cat ? "dg-btn-primary" : "dg-btn-steel"}`}
            >
              {cat === "FRAME" ? "테두리" : cat === "MONSTER" ? "몬스터" : CATEGORY_LABEL[cat]}{" "}
              <span className="font-num">
                {ownedIn(cat)}/{totalIn(cat)}
              </span>
            </button>
          ))}
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="tabpanel" aria-label={CATEGORY_LABEL[tab]}>
          {items.map((item) => {
            const rc = RARITY_CLASS[item.rarity];
            const isEquipped = equippedCode(item.category) === item.code;
            const canCraft = !item.owned && item.fromBox && item.craftCost != null && view.shards >= item.craftCost;
            return (
              <li key={item.code} className={`dg-well flex flex-col gap-2 border-t-4 p-3 ${rc.border}`}>
                <div className="flex items-center justify-between gap-1 text-xs">
                  <span className={`font-bold ${rc.text}`}>{RARITY_LABEL[item.rarity]}</span>
                  {item.isNew && <span className="rounded bg-plate-green px-1.5 py-0.5 font-bold text-white">새로 얻음</span>}
                  {isEquipped && <span className="rounded bg-plate-yellow px-1.5 py-0.5 font-bold text-steel-950">장착 중</span>}
                </div>
                <div className={`flex min-h-[64px] items-center justify-center ${item.owned ? "" : "opacity-35 grayscale"}`}>
                  <ItemPreview item={item} />
                </div>
                <p className="text-sm font-semibold leading-tight">{item.label}</p>
                {item.owned && item.category === "MONSTER" ? (
                  <p className="mt-auto text-xs text-plate-green">던전에서 잡았어요</p>
                ) : item.owned ? (
                  <button
                    type="button"
                    disabled={busyCode != null}
                    onClick={() => void equip(item.category, isEquipped ? null : item.code)}
                    className={`dg-btn mt-auto min-h-[36px] text-xs ${isEquipped ? "dg-btn-steel" : "dg-btn-primary"}`}
                  >
                    {isEquipped ? "빼기" : "장착"}
                  </button>
                ) : item.fromBox ? (
                  <div className="mt-auto space-y-1">
                    <p className="text-xs text-steel-400">보상 상자에서</p>
                    <button
                      type="button"
                      disabled={!canCraft || busyCode != null}
                      onClick={() => void craft(item)}
                      className="dg-btn dg-btn-steel min-h-[32px] w-full text-xs"
                    >
                      조각 {item.craftCost}개로 만들기
                    </button>
                  </div>
                ) : (
                  <div className="mt-auto space-y-1">
                    <p className="text-xs text-steel-400">{item.hint}</p>
                    {item.goal != null && (
                      <>
                        <span className="block h-2 overflow-hidden rounded bg-steel-800" aria-hidden="true">
                          <i
                            className="block h-full bg-plate-green"
                            style={{ width: `${Math.min(100, ((item.progress ?? 0) / item.goal) * 100)}%` }}
                          />
                        </span>
                        <p className="text-right font-num text-xs text-steel-400">
                          {item.goal >= 1000
                            ? `${((item.progress ?? 0) / 1000).toFixed(1)}/${(item.goal / 1000).toFixed(1)}km`
                            : `${item.progress ?? 0}/${item.goal}`}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-center text-xs text-steel-500">
          장착한 것은 지금 내 화면에서만 보여요. 친구에게도 보이게 하는 건 다음에 이어서 할게요.
        </p>
        <Link to="/attendance" className="block text-center text-sm text-steel-400 underline underline-offset-4">
          출석하고 상자 받으러 가기
        </Link>
      </div>

      <DialogFrame open={opened != null} onClose={() => setOpened(null)} title="상자에서 나온 것">
        {opened && (
          <div className="space-y-4 text-center">
            <div className={`dg-pop mx-auto flex flex-col items-center gap-3 rounded-lg border-[3px] p-4 ${RARITY_CLASS[opened.item.rarity].border}`}>
              <span className={`text-sm font-bold ${RARITY_CLASS[opened.item.rarity].text}`}>{RARITY_LABEL[opened.item.rarity]}</span>
              <ItemPreview item={opened.item} size="lg" />
              <p className="font-display text-xl">{opened.item.label}</p>
              <p className="text-xs text-steel-400">{CATEGORY_LABEL[opened.item.category]}</p>
            </div>
            {opened.duplicate ? (
              <p className="text-sm text-steel-300">
                이미 가지고 있어서 조각 <strong className="font-num text-lg text-plate-yellow">+{opened.shardsGained}</strong>개가 됐어요.
              </p>
            ) : (
              <p className="text-sm font-semibold text-plate-green">도감에 새로 넣었어요!</p>
            )}
            <div className="flex gap-2">
              {!opened.duplicate && (
                <button
                  type="button"
                  onClick={() => {
                    void equip(opened.item.category, opened.item.code);
                    setOpened(null);
                  }}
                  className="dg-btn dg-btn-primary min-h-[44px] flex-1"
                >
                  바로 장착
                </button>
              )}
              {view.boxes > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpened(null);
                    void openBox();
                  }}
                  className="dg-btn dg-btn-steel min-h-[44px] flex-1"
                >
                  하나 더 열기 ({view.boxes})
                </button>
              ) : (
                <button type="button" onClick={() => setOpened(null)} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
                  닫기
                </button>
              )}
            </div>
          </div>
        )}
      </DialogFrame>
    </section>
  );
}
