import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { CharacterTier } from "../components/avatar/types";
import { friendlyError } from "../lib/httpError";
import { REALTIME_URL, realtimeAuth } from "../lib/realtime";
import { toast } from "../lib/toast";
import {
  friendApi,
  type FriendRequestView,
  type FriendSearchResult,
  type FriendSummaryView,
} from "../services/friendApi";
import type { FriendCharacterSnapshot, FriendChatMessage } from "../types/friend";

const DEFAULT_TIER: CharacterTier = "BRONZE";
const SEARCH_MIN_LENGTH = 2;
/** 실시간 서버에 못 붙을 때 열린 대화를 다시 불러오는 간격 */
const FALLBACK_POLL_MS = 15_000;

/** 서버가 준 한국어 message 는 살리고, 그 밖(영어·상태 코드)은 우리 문장으로 */
function apiErrorMessage(e: unknown, fallback: string) {
  const message = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof message === "string" && /[가-힣]/.test(message) && message.length <= 120) return message;
  return friendlyError(e, fallback);
}

function FriendAvatar({
  character,
  size = 58,
}: {
  character: FriendCharacterSnapshot | null | undefined;
  size?: number;
}) {
  return (
    <div className="flex-shrink-0 rounded-md border-2 border-black bg-steel-900 p-1">
      <AvatarRenderer
        avatarSeed={character?.avatarSeed ?? "friend-avatar"}
        tier={(character?.tier ?? DEFAULT_TIER) as CharacterTier}
        stage={character?.evolutionStage ?? 0}
        gender={character?.gender}
        isResting={character?.isResting ?? false}
        size={size}
      />
    </div>
  );
}

const RELATION_LABEL: Record<FriendSearchResult["relation"], string> = {
  FRIEND: "이미 친구",
  OUTGOING: "요청 보냄",
  INCOMING: "받은 요청에서 수락",
  NONE: "요청 보내기",
};

export default function Friends() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [incoming, setIncoming] = useState<FriendRequestView[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestView[]>([]);
  const [friends, setFriends] = useState<FriendSummaryView[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [messages, setMessages] = useState<FriendChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [error, setError] = useState("");
  const [unread, setUnread] = useState<Record<number, boolean>>({});
  /** 실시간 서버에 붙지 못했을 때만 true → 안내 문구 + 주기적 새로고침 */
  const [realtimeDown, setRealtimeDown] = useState(REALTIME_URL === null);

  const socketRef = useRef<Socket | null>(null);
  const selectedFriendIdRef = useRef<number | null>(null);
  const friendIdsKeyRef = useRef<string | null>(null);

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.userId === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );

  useEffect(() => {
    selectedFriendIdRef.current = selectedFriendId;
    if (selectedFriendId !== null) {
      setUnread((prev) => (prev[selectedFriendId] ? { ...prev, [selectedFriendId]: false } : prev));
    }
  }, [selectedFriendId]);

  const loadAll = useCallback(async () => {
    try {
      const [inData, outData, friendsData] = await Promise.all([
        friendApi.incoming(),
        friendApi.outgoing(),
        friendApi.list(),
      ]);
      setIncoming(inData);
      setOutgoing(outData);
      setFriends(friendsData);
      setSelectedFriendId((prev) => prev ?? friendsData[0]?.userId ?? null);

      // 실시간 입장권에는 "연결한 순간의 친구 목록"이 들어 있다. 친구가 바뀌면 새 입장권으로 다시 붙는다.
      const key = friendsData.map((friend) => friend.userId).sort((a, b) => a - b).join(",");
      if (friendIdsKeyRef.current !== null && friendIdsKeyRef.current !== key) {
        socketRef.current?.disconnect().connect();
      }
      friendIdsKeyRef.current = key;
    } catch (e) {
      setError(apiErrorMessage(e, "친구 정보를 불러오지 못했어요."));
    }
  }, []);

  const loadMessages = useCallback(async (friendId: number) => {
    try {
      const data = await friendApi.listMessages(friendId, 80);
      if (selectedFriendIdRef.current === friendId) setMessages(data);
    } catch (e) {
      setError(apiErrorMessage(e, "채팅 내역을 불러오지 못했어요."));
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedFriendId) return;
    void loadMessages(selectedFriendId);
  }, [selectedFriendId, loadMessages]);

  // 실시간: 서버는 "새 메시지가 왔다"는 알림만 준다. 내용은 REST 로 다시 읽는다(친구 확인은 백엔드가 한다).
  useEffect(() => {
    if (!REALTIME_URL) return;
    const socket = io(REALTIME_URL, { transports: ["websocket"], auth: realtimeAuth });
    socketRef.current = socket;
    socket.on("connect", () => setRealtimeDown(false));
    socket.on("connect_error", () => setRealtimeDown(true));
    socket.on("friend:notice", (payload: { fromUserId?: unknown }) => {
      const from = Number(payload?.fromUserId);
      if (!Number.isSafeInteger(from)) return;
      if (selectedFriendIdRef.current === from) {
        void loadMessages(from);
      } else {
        setUnread((prev) => ({ ...prev, [from]: true }));
      }
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadMessages]);

  // 실시간을 못 쓰면 열린 대화만 가끔 다시 읽는다
  useEffect(() => {
    if (!realtimeDown || !selectedFriendId) return;
    const timer = window.setInterval(() => void loadMessages(selectedFriendId), FALLBACK_POLL_MS);
    return () => window.clearInterval(timer);
  }, [realtimeDown, selectedFriendId, loadMessages]);

  // 닉네임 검색(입력 후 잠깐 멈추면)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < SEARCH_MIN_LENGTH) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await friendApi.search(q);
        if (!cancelled) setSearchResults(results);
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e, "회원을 찾지 못했어요."));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const onSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (searchQuery.trim().length < SEARCH_MIN_LENGTH) {
      setError("닉네임을 두 글자 이상 입력해 주세요.");
    }
  };

  const onSendRequest = async (target: FriendSearchResult) => {
    setError("");
    try {
      await friendApi.sendRequestToUser(target.userId);
      toast(`${target.nickname}님에게 친구 요청을 보냈어요.`, "success");
      setSearchResults((prev) =>
        prev ? prev.map((item) => (item.userId === target.userId ? { ...item, relation: "OUTGOING" } : item)) : prev
      );
      await loadAll();
    } catch (e) {
      setError(apiErrorMessage(e, "친구 요청을 보내지 못했어요."));
    }
  };

  const onAccept = async (requestId: number) => {
    setError("");
    try {
      await friendApi.accept(requestId);
      await loadAll();
    } catch (e) {
      setError(apiErrorMessage(e, "요청을 수락하지 못했어요."));
    }
  };

  const onReject = async (requestId: number) => {
    setError("");
    try {
      await friendApi.reject(requestId);
      await loadAll();
    } catch (e) {
      setError(apiErrorMessage(e, "요청을 거절하지 못했어요."));
    }
  };

  const onRemoveFriend = async (friendId: number) => {
    if (!window.confirm("이 친구를 삭제할까요?")) return;
    setError("");
    try {
      await friendApi.remove(friendId);
      if (selectedFriendId === friendId) {
        setSelectedFriendId(null);
        setMessages([]);
      }
      await loadAll();
    } catch (e) {
      setError(apiErrorMessage(e, "친구를 삭제하지 못했어요."));
    }
  };

  const onSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFriendId || !messageInput.trim()) return;
    setError("");
    try {
      const sent = await friendApi.sendMessage(selectedFriendId, messageInput.trim());
      setMessageInput("");
      setMessages((prev) => (prev.some((msg) => msg.id === sent.id) ? prev : [...prev, sent]));
      // 상대에게 "새 메시지 있음"만 알린다(내용은 보내지 않는다)
      socketRef.current?.emit("friend:notify", { peerId: selectedFriendId, messageId: sent.id });
    } catch (e) {
      setError(apiErrorMessage(e, "메시지를 보내지 못했어요."));
    }
  };

  return (
    <section className="min-h-screen pt-28 pb-24 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 space-y-6">
        <header className="dg-steel p-5 sm:p-6">
          <p className="font-num text-sm font-bold text-plate-yellow">FRIENDS</p>
          <h1 className="text-3xl">친구 & 1:1 채팅</h1>
          <p className="mt-2 text-sm text-steel-300">닉네임으로 친구를 찾아 요청을 보내고, 친구와 1:1로 대화할 수 있어요.</p>
          {realtimeDown && (
            <p className="mt-2 text-xs text-steel-400">지금은 새 메시지가 바로 뜨지 않을 수 있어요. 열린 대화는 잠시마다 새로 불러와요.</p>
          )}
        </header>

        {error && <p className="dg-pop dg-well border-l-4 border-l-plate-red p-3 text-sm text-chalk" role="alert">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="dg-steel p-4 space-y-3">
              <h2 className="font-display text-lg">친구 찾기</h2>
              <form onSubmit={onSearchSubmit} role="search">
                <label htmlFor="friend-search" className="sr-only">닉네임으로 찾기</label>
                <input
                  id="friend-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  type="search"
                  maxLength={30}
                  autoComplete="off"
                  placeholder="닉네임 두 글자 이상"
                  className="dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
                />
              </form>
              {searching && <p className="text-xs text-steel-400">찾는 중…</p>}
              {!searching && searchResults && searchResults.length === 0 && (
                <p className="text-xs text-steel-400">그 닉네임으로 시작하는 회원이 없어요.</p>
              )}
              {searchResults && searchResults.length > 0 && (
                <ul className="space-y-2">
                  {searchResults.map((result) => (
                    <li key={result.userId} className="dg-well flex items-center gap-3 p-2">
                      <FriendAvatar character={result.character} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{result.nickname}</p>
                        {result.character && (
                          <p className="font-num text-xs font-bold text-plate-yellow">Lv.{result.character.level}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={result.relation !== "NONE"}
                        onClick={() => void onSendRequest(result)}
                        className={`dg-btn min-h-[34px] px-3 text-xs ${
                          result.relation === "NONE" ? "dg-btn-primary" : "dg-btn-steel opacity-70"
                        }`}
                      >
                        {RELATION_LABEL[result.relation]}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="dg-steel p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-steel-200">
                받은 요청
                {incoming.length > 0 && (
                  <span key={incoming.length} className="dg-pop dg-chip bg-plate-red text-xs text-white">{incoming.length}</span>
                )}
              </h2>
              {incoming.length === 0 && <p className="text-xs text-steel-400">받은 요청이 없습니다.</p>}
              {incoming.map((req, idx) => (
                <div key={req.id} className="dg-well dg-rise border-l-[6px] border-l-plate-yellow p-3" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex items-center gap-3">
                    <FriendAvatar character={req.requesterCharacter} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{req.requesterNickname}</p>
                      {req.requesterCharacter && (
                        <p className="font-num text-xs font-bold text-plate-yellow">Lv.{req.requesterCharacter.level}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => void onAccept(req.id)} className="dg-btn dg-chalk-burst min-h-[32px] bg-plate-green px-3 text-xs text-white">수락</button>
                    <button onClick={() => void onReject(req.id)} className="dg-btn dg-btn-steel min-h-[32px] px-3 text-xs">거절</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="dg-steel p-4 space-y-2">
              <h2 className="text-sm font-bold text-steel-200">친구 목록</h2>
              {friends.length === 0 && <p className="text-xs text-steel-400">아직 친구가 없습니다.</p>}
              {friends.map((friend, idx) => (
                <button
                  key={friend.userId}
                  type="button"
                  aria-pressed={selectedFriendId === friend.userId}
                  onClick={() => setSelectedFriendId(friend.userId)}
                  className={`dg-rise w-full rounded-md border-2 border-l-[6px] p-2 text-left transition-all duration-150 ${
                    selectedFriendId === friend.userId
                      ? "border-black border-l-plate-red bg-steel-700 shadow-sm"
                      : "border-black border-l-steel-700 bg-steel-900 hover:-translate-y-0.5 hover:bg-steel-800 hover:shadow-sm"
                  }`}
                  style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <FriendAvatar character={friend.character} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold">
                        {friend.nickname}
                        {unread[friend.userId] && (
                          <span className="dg-chip bg-plate-red text-[11px] text-white">새 메시지</span>
                        )}
                      </p>
                      {friend.character && (
                        <p className="font-num text-sm font-bold text-plate-yellow">
                          {friend.character.tier} · 스테이지 {friend.character.evolutionStage}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {outgoing.length > 0 && (
              <div className="dg-steel p-4 space-y-2">
                <h2 className="text-sm font-bold text-steel-200">보낸 요청</h2>
                {outgoing.map((req) => (
                  <div key={req.id} className="dg-well p-3">
                    <div className="flex items-center gap-3">
                      <FriendAvatar character={req.receiverCharacter} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{req.receiverNickname}</p>
                        <p className="text-xs text-steel-400">수락을 기다리는 중</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <main className="dg-steel p-4">
            {!selectedFriend && (
              <div className="grid h-full min-h-[240px] place-items-center text-center">
                <div className="space-y-3">
                  <span className="dg-loading-plates" aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <p className="text-sm text-steel-400">친구를 선택하면 채팅이 열립니다.</p>
                </div>
              </div>
            )}
            {selectedFriend && (
              <div key={selectedFriend.userId} className="dg-rise flex h-[620px] flex-col">
                <div className="mb-3 flex items-center justify-between gap-2 border-b-2 border-black pb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FriendAvatar character={selectedFriend.character} size={70} />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{selectedFriend.nickname}</p>
                      {selectedFriend.character && (
                        <p className="font-num text-sm font-bold text-plate-yellow">
                          Lv.{selectedFriend.character.level} · {selectedFriend.character.tier} · 스테이지 {selectedFriend.character.evolutionStage}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => void onRemoveFriend(selectedFriend.userId)} className="dg-btn min-h-[32px] flex-shrink-0 bg-steel-900 px-3 text-xs text-red-300 hover:bg-plate-red hover:text-white">
                    친구 삭제
                  </button>
                </div>
                <div className="dg-well flex-1 space-y-2 overflow-y-auto p-3">
                  {messages.length === 0 && <p className="text-xs text-steel-400">아직 메시지가 없습니다.</p>}
                  {messages.map((msg) => {
                    const mine = msg.senderId !== selectedFriend.userId;
                    return (
                      <div
                        key={msg.id}
                        className={`dg-rise max-w-[80%] rounded-md border-2 border-black p-2 shadow-sm ${
                          mine ? "ml-auto bg-plate-blue text-white" : "bg-steel-700 text-chalk"
                        }`}
                      >
                        <p className={`text-xs ${mine ? "text-white/80" : "text-steel-400"}`}>{msg.senderNickname}</p>
                        <p className="break-words text-sm">{msg.content}</p>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={onSendMessage} className="mt-3 flex gap-2">
                  <input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    maxLength={1000}
                    aria-label="메시지"
                    placeholder="메시지를 입력하세요"
                    className="dg-well min-w-0 flex-1 px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
                  />
                  <button type="submit" className="dg-btn dg-btn-primary min-h-[42px] px-4 text-sm">
                    전송
                  </button>
                </form>
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
