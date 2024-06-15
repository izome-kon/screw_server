const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const http = require('http')
dotenv.config({ path: "./config.env" });

const DB = process.env.MONGODB_URI;
const PORT = 5000;
let onlineUsers = 0;

mongoose.set("strictQuery", true);
mongoose.connect(DB).then(() => console.log("DB connect successfully"));

var server = http.createServer(app)

var io = require("socket.io")(server)

io.on('connection', (socket)=>{
  console.log('a user connected');
  onlineUsers++;
  console.log("🚀 ~ io.on ~ onlineUsers:", onlineUsers)

  io.emit('onlineUsers',onlineUsers)
  socket.on('disconnect', () => {
    if(onlineUsers>0)
      onlineUsers --;
    io.emit('onlineUsers',onlineUsers)
    console.log('user disconnected');
  });
})

server.listen(PORT, () => {
  console.log(`listening in port ${PORT}`);
});
