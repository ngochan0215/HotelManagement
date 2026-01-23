import jwt from "jsonwebtoken";

export const socketAuth = (socket, next) => {
  //console.log("Socket attempt to connect!");
  try {
    const raw = socket.handshake?.auth?.token;
    if (!raw) return next(new Error("Authentication error: token required"));

    const token = raw.startsWith("Bearer ") ? raw.split(" ")[1] : raw;
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = payload; // payload = {userId, role}
    return next();
  } catch (err) {
    return next(new Error("Authentication error"));
  }
};