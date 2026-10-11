// 도움말(득근이) 대화 기록 저장소.
// 예전에는 계정과 상관없이 "support_msgs" 하나에 저장해서, 같은 기기에서 다른 사람이 로그인해도
// 이전 사람의 질문이 그대로 보였다. 이제는 로그인한 계정별 키에 저장하고, 로그아웃하면 모두 지운다.
// 로그인하지 않은 상태의 대화는 저장하지 않는다(탭을 닫으면 사라짐).

const PREFIX = "support_msgs";
const LEGACY_KEY = "support_msgs";

type StoredUser = { id?: number; email?: string };

function readUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/** 지금 로그인한 계정의 저장 키. 로그인 안 했으면 null */
export function supportChatKey(): string | null {
  const user = readUser();
  const id = user?.email || (user?.id != null ? String(user.id) : "");
  return id ? `${PREFIX}:${id.toLowerCase()}` : null;
}

/** 모든 계정의 대화 기록과 예전 공용 기록을 지운다(로그아웃 때) */
export function clearSupportChat() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key === LEGACY_KEY || key.startsWith(`${PREFIX}:`))) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* 저장소를 못 쓰면 지울 것도 없다 */
  }
}

/** 예전 공용 키("support_msgs")는 누구 것인지 알 수 없으니 버린다 */
export function dropLegacySupportChat() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* 무시 */
  }
}
