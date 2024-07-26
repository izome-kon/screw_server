const UserModel = require("../models/user.model");
const roomModel = require("../models/room.model");

const { filterMessage } = require("../utils");

module.exports = (io, socket) => {
  socket.on("sendMessage", async (data) => {
    const { roomId, userId, message } = data;
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        socket.emit("error", { message: "User not found" });
        return;
      }
      const roomExists = await roomModel.findById(roomId);
      if (!roomExists) {
        socket.emit("error", { message: "Room not found" });
        return;
      }
      const messageData = {
        userId: user._id,
        username: user.name,
        avatar: user.avatar,
        message: filterMessage(message),
        timestamp: new Date(),
      };
      io.to(roomId).emit("message_received", messageData);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });
};
