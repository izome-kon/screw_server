const mongoose = require('mongoose');
const UserModel = require('./user.model');

const RoomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    maxPlayers: {
        type: Number,
        default: 4,
    },
    status: {
        type: String,
        enum: ['waiting', 'in-game', 'finished'],
        default: 'waiting',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    gameSettings: {
        timeLimit: {
            type: Number,
            default: 30, // 30 seconds for example
        },
        isChatEnabled: {
            type: Boolean,
            default: true,
        },
        isPrivate: {
            type: Boolean,
            default: false,
        },
        gamePoints: {
            type: Number,
            required: true,
        },
    },
});

RoomSchema.statics.createRoom = async function (userId, maxPlayers, gamePoints, delayTime, isChatEnabled, isPrivate) {
    const user = await UserModel.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    const room = await this.create({
        name: `Room ${Date.now()}`,
        players: [user._id],
        maxPlayers,
        gameSettings: {
            timeLimit: delayTime,
            isChatEnabled,
            gamePoints,
            isPrivate,
        }
    });
    return room;
};

RoomSchema.statics.handelCreateRoomEvent = async function (data) {

    const user = await UserModel.findById(data.userId);
    if (!user) {
        throw new Error('User not found');
    }
    let room = await this.create({
        name: `Room ${Date.now()}`,
        players: [user._id],
        maxPlayers: data.maxPlayers,
        gameSettings: {
            timeLimit: data.timeLimit,
            isChatEnabled: data.isChatEnabled,
            gamePoints: data.gamePoints,
            isPrivate: data.isPrivate,
        }
    });
    room = await this.findById(room._id).populate('players', 'email name avatar score');
    // console.log("🚀 ~ room:", room)

    return room;
}

RoomSchema.statics.getRooms = async function () {
    const rooms = await this.find({ 'gameSettings.isPrivate': false }).sort({ createdAt: -1 }).populate('players', 'email name avatar score');
    return rooms;
};

RoomSchema.statics.checkRoomExists = async function (roomId) {
    const room = await this.findById(roomId).populate('players', 'email name avatar score');
    return room;
};

RoomSchema.statics.handelLeaveRoomEvent = async function (roomId, userId) {
    const room = await this.findById(roomId);
    if (!room) {
        throw new Error('Room not found');
    }

    room.players = room.players.filter(player => player.toString() !== userId);

    if (room.players.length === 0) {
        await room.remove();
        return null;
    } else {
        await room.save();
        return await this.findById(roomId).populate('players', 'email name avatar score');
    }
};

RoomSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Room', RoomSchema);