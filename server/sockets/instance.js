let io = null;

export const setSocketInstance = (ioInstance) => {
  io = ioInstance;
};

export const getSocketInstance = () => {
  if (!io) throw new Error("Socket.io instance not initialized");
  return io;
};
