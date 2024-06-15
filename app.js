const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
var log4js = require("log4js");
var morgan = require("morgan");
const usersRouter = require("./routes/usersRouter");
const roomsRouter = require("./routes/roomsRouter");


const AppError = require("./utils/AppError");
const globalErrorHandler = require("./controllers/errorController");
const theAppLog = log4js.getLogger();
const theHTTPLog = morgan({
  "format": "default",
  "stream": {
    write: function(str) { theAppLog.debug(str); }
  }
});
const app = express();
app.use(theHTTPLog);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// { credentials: true, origin: "http://192.168.100.117" }
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use("/api/v1/users", usersRouter);
app.use("/api/v1/rooms", roomsRouter);

app.all("*", (req, res, next) => {
  next(
    new AppError(`this route ${req.originalUrl} doesn't exist on server`, 404)
  );
});

app.use(globalErrorHandler);

module.exports = app;
