import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        system_role: { type: String, enum: ["customer", "employee", "admin"], default: "customer" },
        avatar: { type: String },

        resetPasswordOtp: { type: String },
        resetPasswordExpires: { type: Date },
        emailChangeOtp: {type: String },
        emailChangeNew: { type: String },
        emailChangeExpires: { type: Date },
    },
    {
        timestamps: { createdAt: "create_at", updatedAt: "update_at" },
    }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
