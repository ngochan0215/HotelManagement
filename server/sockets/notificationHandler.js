export default function registerNotificationHandlers(io) {
  io.on("connection", (socket) => {
    const userId = socket.user.userId;
    socket.join(`user:${userId}`);
    console.log("socket connected: ", socket.id);
    console.log(`[Notification] User ${userId} connected`);

    // test notification
    socket.on("test-notify", (data) => {
        io.to(`user:${userId}`).emit("receive-notification", {
            title: "New Notification",
            message: data?.message || "No message",
            time: new Date(),
        });
    });

    socket.on("disconnect", (reason) => {
        console.log("socket disconnected", socket.id, "reason:", reason);
        console.log(`[Notification] User ${userId} disconnected`);
    });
  });
}