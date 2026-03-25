import { api } from "../lib/api";
import type { CrewDetail, CrewJoinRequest, CrewJoinResult, CrewListItem } from "../types/crew";

export const crewApi = {
  list: () => api.get<CrewListItem[]>("/api/crew/groups").then((res) => res.data),

  create: (payload: { name: string; description?: string; joinPolicy?: "AUTO_APPROVE" | "LEADER_APPROVE" }) =>
    api.post<CrewDetail>("/api/crew/groups", payload).then((res) => res.data),

  getDetail: (id: number, month?: string) =>
    api.get<CrewDetail>(`/api/crew/groups/${id}`, { params: month ? { month } : undefined }).then((res) => res.data),

  join: (id: number) => api.post<CrewJoinResult>(`/api/crew/groups/${id}/join`).then((res) => res.data),

  joinByCode: (inviteCode: string) =>
    api.post<CrewJoinResult>(`/api/crew/groups/join-by-code/${inviteCode}`).then((res) => res.data),

  leave: (id: number) => api.delete(`/api/crew/groups/${id}/leave`),

  update: (id: number, payload: { name: string; description?: string; joinPolicy?: "AUTO_APPROVE" | "LEADER_APPROVE" }) =>
    api.put<CrewDetail>(`/api/crew/groups/${id}`, payload).then((res) => res.data),

  remove: (id: number) => api.delete(`/api/crew/groups/${id}`),

  kickMember: (crewId: number, memberUserId: number) =>
    api.delete(`/api/crew/groups/${crewId}/members/${memberUserId}`),

  listJoinRequests: (crewId: number) =>
    api.get<CrewJoinRequest[]>(`/api/crew/groups/${crewId}/join-requests`).then((res) => res.data),

  approveJoinRequest: (crewId: number, requestId: number) =>
    api.post(`/api/crew/groups/${crewId}/join-requests/${requestId}/approve`),

  rejectJoinRequest: (crewId: number, requestId: number) =>
    api.post(`/api/crew/groups/${crewId}/join-requests/${requestId}/reject`),

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
