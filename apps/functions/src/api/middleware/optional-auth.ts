import { Request, Response, NextFunction } from "express";
import { resolveAuthContextFromRequest } from "../../lib/auth-context";

/**
 * Best-effort auth: populates req.user when a valid token/session cookie is
 * present, but NEVER rejects and NEVER enforces MFA. Used by endpoints that must
 * accept anonymous traffic (e.g. client-error ingestion that may fire before
 * login or during a crash) while still attributing logged-in users' requests.
 */
export const attachUserIfPresent = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authContext = await resolveAuthContextFromRequest(req, {
      requireStrictClaims: false,
    });
    req.user = authContext;
  } catch {
    // Anonymous / invalid token — leave req.user undefined and continue.
  }
  next();
};
