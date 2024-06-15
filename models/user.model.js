const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
    score: {
      type: Number,
      default: 0,
    },
    passwordResetToken: String,
    passwordResetTokenExpires: Date,
    changedPassword: Date,
  },
  { timestamps: true }
);

userSchema.statics.login = async function (email, password) {
  const user = await this.findOne({ email });
  let isPasswordCorrect;

  if (user) {
    isPasswordCorrect = await bcrypt.compare(password, user.password);
  }
  if (!user || !isPasswordCorrect) {
    throw Error("Password or email aren't correct");
  }

  return user;
};

userSchema.statics.signup = async function (email, password, name, avatar) {
  const user = await this.findOne({ email });

  if (user) {
    throw Error("This email is already in use");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await this.create({ email, password: hashedPassword, name, avatar });

  return newUser;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetTokenExpires = Date.now() + 24 * 60 * 60 * 1000;

  return resetToken;
};

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
