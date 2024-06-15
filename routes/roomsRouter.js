const express = require("express");
const roomController = require("../controllers/roomController");
const verifyToken = require("../middleware/authMiddleware");

const Router = express.Router();

Router.post(
  "/create",
  verifyToken,
  roomController.CreateRoom
);
Router.get(
  "/index",
  verifyToken,
  roomController.GetRooms
);
// Router.post("/login", userController.ValidateLogInData, userController.LogIn);

module.exports = Router;
