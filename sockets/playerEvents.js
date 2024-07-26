const roomModel = require("../models/room.model");
const { startGame, startTimer } = require("../utils");

module.exports = (io, socket) => {
  socket.on("setPlayerReady", async (data) => {
    const { roomId, userId } = data;
    try {
      let room = await roomModel.findById(roomId);
      if (!room) {
        throw new Error("Room not found");
      }
      room = await room.setPlayerReady(userId);
      io.to(roomId).emit("player_ready", { roomId, userId });

      const allPlayersReady = room.players.every((player) => player.isReady);
      if (allPlayersReady) {
        room.status = "in-game";
        const updatedRoom = await startGame(io, room);
        await updatedRoom.save();
        io.to(roomId).emit("start_game", updatedRoom);
        startTimer(io, roomId, room.gameSettings.timeLimit);
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });
};
