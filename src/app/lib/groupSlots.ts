type UnknownRecord = Record<string, unknown>;

export type GroupMemberSlot = {
  memberId: string;
  slotId: string;
};

const toStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

const hasOwn = (obj: UnknownRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const createSlotId = (memberId: string, seed: number): string =>
  `${memberId}:slot:${Date.now().toString(36)}:${seed.toString(36)}`;

export function normalizeGroupMemberSlots(input: unknown): GroupMemberSlot[] {
  if (!Array.isArray(input)) return [];

  const out: GroupMemberSlot[] = [];
  const used = new Set<string>();

  for (let i = 0; i < input.length; i += 1) {
    const item = input[i];
    let memberId = "";
    let slotId = "";

    if (typeof item === "string" || typeof item === "number") {
      memberId = toStr(item);
    } else if (item && typeof item === "object") {
      const rec = item as UnknownRecord;
      memberId = toStr(
        rec.memberId ??
          rec._id ??
          rec.id ??
          (hasOwn(rec, "member") ? (rec.member as UnknownRecord)?._id : undefined),
      );
      slotId = toStr(rec.slotId ?? rec.memberSlotId);
    }

    if (!memberId) continue;
    if (!slotId) {
      slotId = `${memberId}:legacy:${i + 1}`;
    }

    if (used.has(slotId)) {
      slotId = `${slotId}:${i + 1}`;
    }
    used.add(slotId);
    out.push({ memberId, slotId });
  }

  return out;
}

export function slotsToStoredMembers(slots: GroupMemberSlot[]): UnknownRecord[] {
  return slots.map((s) => ({
    memberId: s.memberId,
    _id: s.memberId,
    slotId: s.slotId,
  }));
}

export function uniqueMemberIds(slots: GroupMemberSlot[]): string[] {
  return Array.from(new Set(slots.map((s) => s.memberId).filter(Boolean)));
}

export function countSlotsByMember(slots: GroupMemberSlot[], memberId: string): number {
  return slots.filter((s) => s.memberId === memberId).length;
}

