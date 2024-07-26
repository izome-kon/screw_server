const connectionEvents = require("./connectionEvents");
const roomEvents = require("./roomEvents");
const messageEvents = require("./messageEvents");
const gameEvents = require("./gameEvents");
const playerEvents = require("./playerEvents");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("a user connected");
    global.onlineUsers = (global.onlineUsers || 0) + 1;
    io.emit("onlineUsers", global.onlineUsers);

    connectionEvents(io, socket);
    roomEvents(io, socket);
    messageEvents(io, socket);
    gameEvents(io, socket);
    playerEvents(io, socket);
  });
};
