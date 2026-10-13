export const ROOT_ADMIN_UID = "3H3BclyO2FePQ59KYIO2kKSirnx2";

export function getAdminSessionExpiry(now = Date.now()) {
  const expiry = new Date(now);
  const dayOfMonth = expiry.getUTCDate();
  expiry.setUTCDate(1);
  expiry.setUTCMonth(expiry.getUTCMonth() + 4);
  const lastDay = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate();
  expiry.setUTCDate(Math.min(dayOfMonth, lastDay));
  return expiry.getTime();
}

export type AdminRecord = {
  enabled?: unknown;
  expiresAt?: number;
  inviteId?: unknown;
  codeHash?: unknown;
};

export function isAdminSource(uid: string, record: AdminRecord) {
  return uid === ROOT_ADMIN_UID ||
    (typeof record.inviteId === "string" && record.inviteId.length >= 16) ||
    (typeof record.codeHash === "string" && record.codeHash.length > 0);
}

export function isAdminIdentity(uid: string, record: AdminRecord, now = Date.now()) {
  return record.enabled === true &&
    typeof record.expiresAt === "number" &&
    record.expiresAt > now &&
    isAdminSource(uid, record);
}
