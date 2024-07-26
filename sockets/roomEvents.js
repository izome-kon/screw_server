const roomModel = require("../models/room.model");
const UserModel = require("../models/user.model");

module.exports = (io, socket) => {
  socket.on("createRoom", async (data) => {
    const room = await roomModel.handelCreateRoomEvent(JSON.parse(data));
    if (room) {
      socket.join(room.id);
      io.emit("new_room", room);
      io.to(room.id).emit("user_joined", room);
    }
  });

  socket.on("joinRoom", async (data) => {
    const { roomId, userId } = data;
    const roomExists = await roomModel.findById(roomId);
    if (roomExists) {
      const user = await UserModel.findById(userId);
      if (!user) {
        socket.emit("error", { message: "User not found" });
        return;
      }
      if (
        !roomExists.players.find(
          (player) => player.user.toString() === user._id.toString()
        )
      ) {
        roomExists.players.push({ user: user._id });
        await roomExists.save();
      }
      socket.join(roomId);
      const currRoom = await roomModel.checkRoomExists(roomId);
      io.to(roomId).emit("user_joined", { user, roomId, room: currRoom });
      socket.emit("room_joined", currRoom);
    } else {
      socket.emit("error", { message: "Room does not exist" });
    }
  });

  socket.on("leaveRoom", async (data) => {
    const { roomId, userId } = data;
    try {
      const room = await roomModel.handelLeaveRoomEvent(roomId, userId);
      if (room) {
        socket.leave(roomId);
        io.to(roomId).emit("user_left", { roomId, userId });
        if (room.players.length === 0) {
          await roomModel.deleteRoom(roomId);
          io.emit("room_deleted", roomId);
        } else {
          io.emit("room_updated", room);
        }
      } else {
        io.emit("room_deleted", roomId);
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });
};
