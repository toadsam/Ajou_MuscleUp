export type CustomPart = "face" | "body" | "emblem";

export type AvatarCustomization = {
  face?: string | null;
  body?: string | null;
  emblem?: string | null;
};

export const CUSTOM_UNLOCK_REQUIREMENTS: Record<CustomPart, number> = {
  face: 3,
  body: 3,
  emblem: 3,
};

export const CUSTOM_PART_LABEL: Record<CustomPart, string> = {
  face: "Face",
  body: "Body",
  emblem: "Emblem",
};

const STORAGE_PREFIX = "avatar-custom-v1:";

const safeEmailKey = (email?: string | null) => (email?.trim().toLowerCase() || "guest");

const storageKey = (email?: string | null) => `${STORAGE_PREFIX}${safeEmailKey(email)}`;

export const getUnlockedParts = (attendanceCount: number): Record<CustomPart, boolean> => ({
  face: attendanceCount >= CUSTOM_UNLOCK_REQUIREMENTS.face,
  body: attendanceCount >= CUSTOM_UNLOCK_REQUIREMENTS.body,
  emblem: attendanceCount >= CUSTOM_UNLOCK_REQUIREMENTS.emblem,
});

export const loadAvatarCustomization = (email?: string | null): AvatarCustomization => {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AvatarCustomization;
    return {
      face: typeof parsed.face === "string" ? parsed.face : null,
      body: typeof parsed.body === "string" ? parsed.body : null,
      emblem: typeof parsed.emblem === "string" ? parsed.emblem : null,
    };
  } catch {
    return {};
  }
};

export const saveAvatarCustomization = (email: string | null | undefined, next: AvatarCustomization) => {
  localStorage.setItem(storageKey(email), JSON.stringify(next));
};
