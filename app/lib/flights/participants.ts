export const participantRoleOptions = [
  "PIC",
  "SIC",
  "INSTRUCTOR",
  "STUDENT"
] as const;

export type ParticipantRole = (typeof participantRoleOptions)[number];

const participantRoleSet = new Set(participantRoleOptions);

type ParticipantInput = {
  userId: string;
  role: ParticipantRole;
};

export function parseParticipantFormData(formData: FormData): ParticipantInput[] {
  const userIds = formData
    .getAll("participantUserId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const roles = formData.getAll("participantRole").map((value) => String(value));

  return userIds.map((userId, index) => {
    const role = roles[index];
    return {
      userId,
      role: participantRoleSet.has(role as ParticipantRole) ? (role as ParticipantRole) : "SIC"
    };
  });
}

export function normalizeParticipants(
  ownerId: string,
  participants: ParticipantInput[]
): ParticipantInput[] {
  const seen = new Set([ownerId]);
  return participants.filter((participant) => {
    if (!participant.userId || seen.has(participant.userId)) {
      return false;
    }
    seen.add(participant.userId);
    return true;
  });
}
