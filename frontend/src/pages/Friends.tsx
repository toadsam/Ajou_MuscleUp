import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { CharacterTier } from "../components/avatar/types";
import { friendApi } from "../services/friendApi";
import type {
  FriendCharacterSnapshot,
  FriendChatMessage,
  FriendRequestItem,
  FriendSummary,
} from "../types/friend";

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001";

type LocalUser = {
  email?: string;
};

const DEFAULT_TIER: CharacterTier = "BRONZE";

function FriendAvatar({
  character,
  size = 58,
}: {
  character: FriendCharacterSnapshot | null | undefined;
  size?: number;
}) {
  return (
    <div className="flex-shrink-0 rounded-xl border border-white/15 bg-slate-900/80 p-1">
      <AvatarRenderer
        avatarSeed={character?.avatarSeed ?? "friend-avatar"}
        tier={(character?.tier ?? DEFAULT_TIER) as CharacterTier}
        stage={character?.evolutionStage ?? 0}
        size={size}
      />
    </div>
  );
}

export default function Friends() {
  const [meEmail, setMeEmail] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [messages, setMessages] = useState<FriendChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.userId === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );

  const loadAll = async () => {
    try {
      const [inData, outData, friendsData] = await Promise.all([
        friendApi.incoming(),
        friendApi.outgoing(),
        friendApi.list(),
      ]);
      setIncoming(inData);
      setOutgoing(outData);
      setFriends(friendsData);
      if (!selectedFriendId && friendsData.length > 0) setSelectedFriendId(friendsData[0].userId);
    } catch (e: any) {
      setError(e?.response?.data?.message || "친구 정보를 불러오지 못했습니다.");
    }
  };

  const loadMessages = async (friendId: number) => {
    try {
      const data = await friendApi.listMessages(friendId, 80);
      setMessages(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "채팅 내역을 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as LocalUser;
      setMeEmail((parsed.email ?? "").toLowerCase());
    } catch {
      setMeEmail("");
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedFriendId) return;
    void loadMessages(selectedFriendId);
  }, [selectedFriendId]);

  useEffect(() => {
    if (!meEmail) return;
    const nextSocket = io(REALTIME_URL, { transports: ["websocket"] });
    setSocket(nextSocket);
    nextSocket.on("connect", () => {
      setConnected(true);
      nextSocket.emit("friend:join", { userId: meEmail });
    });
    nextSocket.on("disconnect", () => {
      setConnected(false);
    });
    nextSocket.on("friend:message", (payload) => {
      if (!payload || typeof payload !== "object") return;
      const from = String(payload.from ?? "").toLowerCase();
      const to = String(payload.to ?? "").toLowerCase();
      const selectedEmail = selectedFriend?.email.toLowerCase();
      if (!selectedEmail) return;
      const isTargetRoom =
        (from === selectedEmail && to === meEmail) ||
        (from === meEmail && to === selectedEmail);
      if (!isTargetRoom) return;
      const msg = payload.message as FriendChatMessage | undefined;
      if (!msg?.id) return;
      setMessages((prev) => {
        if (prev.some((it) => it.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => {
      nextSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [meEmail, selectedFriend?.email]);

  useEffect(() => {
    if (!socket || !selectedFriend || !connected) return;
    socket.emit("friend:subscribe", { peerId: selectedFriend.email.toLowerCase() });
  }, [socket, selectedFriend, connected]);

  const onSendRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!targetEmail.trim()) return;
    setError("");
    try {
      await friendApi.sendRequest(targetEmail.trim());
      setTargetEmail("");
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || "친구 요청 전송에 실패했습니다.");
    }
  };

  const onAccept = async (requestId: number) => {
    setError("");
    try {
      await friendApi.accept(requestId);
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || "요청 수락에 실패했습니다.");
    }
  };

  const onReject = async (requestId: number) => {
    setError("");
    try {
      await friendApi.reject(requestId);
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || "요청 거절에 실패했습니다.");
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
    } catch (e: any) {
      setError(e?.response?.data?.message || "친구 삭제에 실패했습니다.");
    }
  };

  const onSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFriendId || !messageInput.trim()) return;
    setError("");
    try {
      const sent = await friendApi.sendMessage(selectedFriendId, messageInput.trim());
      setMessageInput("");
      if (socket && selectedFriend) {
        socket.emit("friend:send", {
          peerId: selectedFriend.email.toLowerCase(),
          message: sent,
        });
      }
      setMessages((prev) => (prev.some((msg) => msg.id === sent.id) ? prev : [...prev, sent]));
    } catch (e: any) {
      setError(e?.response?.data?.message || "메시지 전송에 실패했습니다.");
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 pt-28 pb-24 text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 space-y-6">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-cyan-300">FRIENDS</p>
          <h1 className="text-3xl font-extrabold">친구 & 1:1 채팅</h1>
          <p className="mt-2 text-sm text-gray-300">친구 요청을 보내고, 목록을 관리하며, 실시간으로 대화할 수 있습니다.</p>
          <p className="mt-1 text-xs text-gray-400">실시간 연결: {connected ? "연결됨" : "연결 끊김"}</p>
        </header>

        {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <form onSubmit={onSendRequest} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <h2 className="text-lg font-bold">친구 요청 보내기</h2>
              <input
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                type="email"
                placeholder="friend@example.com"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
              <button type="submit" className="w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">
                요청 보내기
              </button>
            </form>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-300">받은 요청</h2>
              {incoming.length === 0 && <p className="text-xs text-gray-400">받은 요청이 없습니다.</p>}
              {incoming.map((req) => (
                <div key={req.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-3">
                    <FriendAvatar character={req.requesterCharacter} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{req.requesterNickname}</p>
                      <p className="truncate text-xs text-gray-400">{req.requesterEmail}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => void onAccept(req.id)} className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">수락</button>
                    <button onClick={() => void onReject(req.id)} className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-200">거절</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-300">친구 목록</h2>
              {friends.length === 0 && <p className="text-xs text-gray-400">아직 친구가 없습니다.</p>}
              {friends.map((friend) => (
                <button
                  key={friend.userId}
                  type="button"
                  onClick={() => setSelectedFriendId(friend.userId)}
                  className={`w-full rounded-xl border p-2 text-left ${
                    selectedFriendId === friend.userId ? "border-cyan-300 bg-cyan-500/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FriendAvatar character={friend.character} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{friend.nickname}</p>
                      <p className="truncate text-xs text-gray-400">{friend.email}</p>
                      {friend.character && (
                        <p className="text-[11px] text-cyan-200/80">
                          {friend.character.tier} · 스테이지 {friend.character.evolutionStage}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {outgoing.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <h2 className="text-sm font-semibold text-gray-300">보낸 요청</h2>
                {outgoing.map((req) => (
                  <div key={req.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-3">
                      <FriendAvatar character={req.receiverCharacter} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{req.receiverNickname}</p>
                        <p className="truncate text-xs text-gray-400">{req.receiverEmail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <main className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {!selectedFriend && <p className="text-sm text-gray-400">친구를 선택하면 채팅이 열립니다.</p>}
            {selectedFriend && (
              <div className="flex h-[620px] flex-col">
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <FriendAvatar character={selectedFriend.character} size={70} />
                    <div>
                      <p className="font-bold">{selectedFriend.nickname}</p>
                      <p className="text-xs text-gray-400">{selectedFriend.email}</p>
                      {selectedFriend.character && (
                        <p className="text-[11px] text-cyan-200/80">
                          Lv.{selectedFriend.character.level} · {selectedFriend.character.tier} · 스테이지 {selectedFriend.character.evolutionStage}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => void onRemoveFriend(selectedFriend.userId)} className="rounded-lg border border-red-400/40 px-2 py-1 text-xs text-red-300">
                    친구 삭제
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
                  {messages.length === 0 && <p className="text-xs text-gray-400">아직 메시지가 없습니다.</p>}
                  {messages.map((msg) => (
                    <div key={msg.id} className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <p className="text-xs text-gray-400">{msg.senderNickname}</p>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={onSendMessage} className="mt-3 flex gap-2">
                  <input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="메시지를 입력하세요"
                    className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
                  />
                  <button type="submit" className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">
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



