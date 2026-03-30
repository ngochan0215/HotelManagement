import mongoose from "../../../shared/config/mongoose.js";

const userSchema = new mongoose.Schema(
    {
        email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        system_role: { type: String, enum: ["customer", "employee", "manager"], default: "customer", required: true },
        avatar: { type: String },

        emailVerified: { type: Boolean, default: false },
        isBanned: { type: Boolean, default: false },
        
        verifyEmailOtp: { type: String },
        verifyEmailOtpExpires: { type: Date },

        resetPasswordOtp: { type: String },
        resetPasswordExpires: { type: Date },

        emailChangeOtp: {type: String },
        emailChangeNew: { type: String },
        emailChangeExpires: { type: Date },

        type: { type: String, enum: ["default", "google"] }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

userSchema.index({ system_role: 1 });
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;

console.log("User model mongoose state:", mongoose.connection.readyState);
