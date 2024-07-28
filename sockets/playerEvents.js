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

        // Perform necessary actions to start the game
        const updatedRoom = await startGame(io, room);
        // Save the room status and emit the start_game event
        // await updatedRoom.save();
        io.to(roomId).emit("start_game", updatedRoom);

        // Start the game timer
        startTimer(io, roomId, room.gameSettings.timeLimit);
      }
    } catch (error) {
      console.log("🚀 ~ socket.on ~ error:", error);
      socket.emit("error", { message: error.message });
    }
  });
};
