const roomModel = require("../models/room.model");

const {
  startGame,
  handlePlayerMove,
  isGameOver,
  isRoundOver,
  startPlayerTurnTimer,
  safeEmit,
} = require("../utils");

module.exports = (io, socket) => {
  socket.on("playerMove", async (data) => {
    console.log("🚀 ~ socket.on ~ playerMove:", data);
    const { roomId, userId, move } = data;
    try {
      const room = await roomModel.findById(roomId);
      if (!room) {
        console.log("🚀 ~ socket.on ~ Room not found:");
        throw new Error("Room not found");
      }
      const updatedRoom = await handlePlayerMove(io, room, userId, move);
      if (isRoundOver(updatedRoom)) {
        safeEmit(io.to(roomId), "round_over", updatedRoom);
        // io.to(roomId).emit("round_over", updatedRoom);
      }
      if (isGameOver(updatedRoom)) {
        safeEmit(io.to(roomId), "game_over", updatedRoom);
        // io.to(roomId).emit("game_over", updatedRoom);
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
      console.log("🚀 ~ socket.on ~ error:", error);
    }
  });
  socket.on("playerDraw", async (data) => {
    // Implement drawing logic here
    const { roomId, userId } = data;

    try {
      const room = await roomModel.findById(roomId);
      if (!room) {
        throw new Error("Room not found");
      }
      // room.gameState.curruntDrawCard = room.gameState.deck.pop();

      // await room.save();
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
    io.to(roomId).emit("player_draw", { userId });
  });
};
