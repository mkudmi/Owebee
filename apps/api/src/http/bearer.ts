export function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function unauthorized(reply: {
  code(statusCode: number): { send(payload: unknown): unknown };
}) {
  return reply.code(401).send({
    error: {
      code: "auth.unauthorized",
      message: "Authentication is required"
    }
  });
}
