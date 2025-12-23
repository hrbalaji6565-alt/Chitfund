import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET!;
if (!SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

// Create token
export function signToken(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: "1d" });
}

// Verify token
export function verifyToken(token: string) {
  return jwt.verify(token, SECRET);
}
