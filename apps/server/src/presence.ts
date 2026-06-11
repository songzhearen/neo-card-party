import type { User } from "./db";
import { isAdminUser } from "./db/repos/userRepo";

export type OnlineUserStatus = "lobby" | "room" | "reconnecting";

export interface OnlineUserRecord {
  userId: number;
  account: string;
  nickname: string;
  avatar: string;
  isAdmin: boolean;
  status: OnlineUserStatus;
  roomId: string | null;
  roomName: string | null;
  sessionId: string | null;
  seat: number | null;
  connected: boolean;
  lastActiveAt: number;
}

interface RoomPresencePatch {
  roomId?: string | null;
  roomName?: string | null;
  sessionId?: string | null;
  seat?: number | null;
}

const ONLINE_TTL_MS = 90_000;
const onlineUsers = new Map<number, OnlineUserRecord>();

function now(): number {
  return Date.now();
}

function isFresh(record: OnlineUserRecord, time = now()): boolean {
  return time - record.lastActiveAt <= ONLINE_TTL_MS;
}

function identityFromUser(user: User): Pick<OnlineUserRecord, "userId" | "account" | "nickname" | "avatar" | "isAdmin"> {
  return {
    userId: user.id,
    account: user.account || user.username || String(user.id),
    nickname: user.nickname || user.username || user.account || `Player ${user.id}`,
    avatar: user.avatar || "",
    isAdmin: isAdminUser(user),
  };
}

function pruneExpired(time = now()): void {
  for (const [userId, record] of onlineUsers) {
    if (!isFresh(record, time)) onlineUsers.delete(userId);
  }
}

export function markHeartbeat(user: User): OnlineUserRecord {
  const time = now();
  pruneExpired(time);

  const previous = onlineUsers.get(user.id);
  const base = identityFromUser(user);
  const keepRoom = previous && isFresh(previous, time) && previous.roomId;
  const next: OnlineUserRecord = {
    ...base,
    status: keepRoom ? previous.status : "lobby",
    roomId: keepRoom ? previous.roomId : null,
    roomName: keepRoom ? previous.roomName : null,
    sessionId: keepRoom ? previous.sessionId : null,
    seat: keepRoom ? previous.seat : null,
    connected: keepRoom ? previous.connected : true,
    lastActiveAt: time,
  };

  onlineUsers.set(user.id, next);
  return next;
}

export function markRoomJoin(user: User, patch: RoomPresencePatch): OnlineUserRecord {
  const time = now();
  pruneExpired(time);

  const previous = onlineUsers.get(user.id);
  const next: OnlineUserRecord = {
    ...identityFromUser(user),
    status: "room",
    roomId: patch.roomId ?? previous?.roomId ?? null,
    roomName: patch.roomName ?? previous?.roomName ?? null,
    sessionId: patch.sessionId ?? previous?.sessionId ?? null,
    seat: patch.seat ?? previous?.seat ?? null,
    connected: true,
    lastActiveAt: time,
  };

  onlineUsers.set(user.id, next);
  return next;
}

export function markRoomConnected(userId: number, patch: RoomPresencePatch): void {
  const previous = onlineUsers.get(userId);
  if (!previous) return;

  onlineUsers.set(userId, {
    ...previous,
    status: "room",
    roomId: patch.roomId ?? previous.roomId,
    roomName: patch.roomName ?? previous.roomName,
    sessionId: patch.sessionId ?? previous.sessionId,
    seat: patch.seat ?? previous.seat,
    connected: true,
    lastActiveAt: now(),
  });
}

export function markRoomReconnecting(userId: number, patch: RoomPresencePatch): void {
  const previous = onlineUsers.get(userId);
  if (!previous) return;

  onlineUsers.set(userId, {
    ...previous,
    status: "reconnecting",
    roomId: patch.roomId ?? previous.roomId,
    roomName: patch.roomName ?? previous.roomName,
    sessionId: patch.sessionId ?? previous.sessionId,
    seat: patch.seat ?? previous.seat,
    connected: false,
    lastActiveAt: now(),
  });
}

export function markRoomLeave(userId: number, patch: RoomPresencePatch = {}): void {
  const previous = onlineUsers.get(userId);
  if (!previous) return;
  if (patch.roomId && previous.roomId && patch.roomId !== previous.roomId) return;
  if (patch.sessionId && previous.sessionId && patch.sessionId !== previous.sessionId) return;

  onlineUsers.set(userId, {
    ...previous,
    status: "lobby",
    roomId: null,
    roomName: null,
    sessionId: null,
    seat: null,
    connected: true,
    lastActiveAt: now(),
  });
}

export function listOnlineUsers(): OnlineUserRecord[] {
  pruneExpired();
  return [...onlineUsers.values()].sort((a, b) => {
    const statusRank: Record<OnlineUserStatus, number> = { room: 0, reconnecting: 1, lobby: 2 };
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    return b.lastActiveAt - a.lastActiveAt;
  });
}

export function getOnlineUser(userId: number): OnlineUserRecord | null {
  pruneExpired();
  return onlineUsers.get(userId) || null;
}

export const presenceConfig = {
  onlineTtlMs: ONLINE_TTL_MS,
};
