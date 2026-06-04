import jwt from "jsonwebtoken";

export const socketAuth = (socket, next) => {
    try {
        const raw = socket.handshake?.auth?.token;
        if (!raw) return next(new Error("Authentication error: token required"));

        const token = raw.startsWith("Bearer ") ? raw.split(" ")[1] : raw;
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        socket.user = payload; // { id, role, ... }
        return next();
    } catch {
        return next(new Error("Authentication error: invalid token"));
    }
};
