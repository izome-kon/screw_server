const roomModel = require("../models/room.model");

exports.CreateRoom = (req, res) => {
    roomModel.createRoom(req.body.userId, req.body.maxPlayers, req.body.gamePoints, req.body.delayTime, req.body.isChatEnabled)
        .then(async (room) => {
            return res.json({
                status: "success",
                data: {
                    id: room._id,
                    name: room.name,
                    players: room.players,
                    maxPlayers: room.maxPlayers,
                    gameSettings: room.gameSettings,
                    isPrivate: room.isPrivate,
                },
            });
        })
        .catch((err) => {
            return res.status(401).json({
                status: "failed",
                message: err.message,
            });
        });
};

exports.GetRooms = (req, res) => {
    roomModel.getRooms()
        .then(async (rooms) => {
            return res.json({
                status: "success",
                data: rooms,
            });
        })
        .catch((err) => {
            return res.status(401).json({
                status: "failed",
                message: err.message,
            });
        });
}
