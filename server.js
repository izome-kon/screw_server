const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const socketEvents = require("./sockets/socketEvents");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

const server = http.createServer(app);
const io = require("socket.io")(server);

const PORT = process.env.PORT || 5000;
connectDB();
socketEvents(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
