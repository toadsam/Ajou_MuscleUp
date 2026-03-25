import { api } from "../lib/api";
import type { CrewDetail, CrewListItem } from "../types/crew";

export const crewApi = {
  list: () => api.get<CrewListItem[]>("/api/crew/groups").then((res) => res.data),

  create: (payload: { name: string; description?: string }) =>
    api.post<CrewDetail>("/api/crew/groups", payload).then((res) => res.data),

  getDetail: (id: number, month?: string) =>
    api.get<CrewDetail>(`/api/crew/groups/${id}`, { params: month ? { month } : undefined }).then((res) => res.data),

  join: (id: number) => api.post(`/api/crew/groups/${id}/join`),

  joinByCode: (inviteCode: string) => api.post(`/api/crew/groups/join-by-code/${inviteCode}`),

  leave: (id: number) => api.delete(`/api/crew/groups/${id}/leave`),

  update: (id: number, payload: { name: string; description?: string }) =>
    api.put<CrewDetail>(`/api/crew/groups/${id}`, payload).then((res) => res.data),

  remove: (id: number) => api.delete(`/api/crew/groups/${id}`),

  kickMember: (crewId: number, memberUserId: number) =>
    api.delete(`/api/crew/groups/${crewId}/members/${memberUserId}`),

  createChallenge: (
    crewId: number,
    payload: { title: string; description?: string; startDate: string; endDate: string; targetWorkoutDays: number }
  ) => api.post(`/api/crew/groups/${crewId}/challenges`, payload),

  updateChallenge: (
    crewId: number,
    challengeId: number,
    payload: { title: string; description?: string; startDate: string; endDate: string; targetWorkoutDays: number }
  ) => api.put(`/api/crew/groups/${crewId}/challenges/${challengeId}`, payload),

  deleteChallenge: (crewId: number, challengeId: number) =>
    api.delete(`/api/crew/groups/${crewId}/challenges/${challengeId}`),
};
