import jwt from "jsonwebtoken";

// Validate the "Authorization: Bearer <token>" in the request header,
// if it passes, put the logged-in user information into req.user.
export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Use after authenticate: only lets users with the given role through (e.g. requireRole("admin")).
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: "You do not have access to this" });
    }
    next();
  };
}
