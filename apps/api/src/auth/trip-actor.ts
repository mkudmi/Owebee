import { InvalidSessionError, type AuthService } from "./auth-service.js";
import type { InviteService } from "../invites/invite-service.js";
import { parseBearerToken } from "../http/bearer.js";

export type TripActor =
  | { type: "registered"; userId: string }
  | { type: "guest"; memberId: string; tripId: string };

export async function resolveTripActor(
  authorizationHeader: string | undefined,
  services: { authService: AuthService; inviteService: InviteService }
): Promise<TripActor | null> {
  const token = parseBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }

  try {
    const user = await services.authService.getUserBySessionToken(token);
    return { type: "registered", userId: user.id };
  } catch (error) {
    if (!(error instanceof InvalidSessionError)) {
      throw error;
    }
  }

  const guest = await services.inviteService.getGuestBySessionToken(token);
  return guest
    ? { type: "guest", memberId: guest.memberId, tripId: guest.tripId }
    : null;
}
