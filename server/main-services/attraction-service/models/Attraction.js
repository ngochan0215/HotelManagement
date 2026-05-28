import mongoose from "../../../shared/config/mongoose.js";

const attractionSchema = new mongoose.Schema(
    {
        xid: { type: String, required: true, unique: true },

        name: { type: String, required: true },

        category: {
            type: String,
            enum: ["cultural", "natural", "food", "entertainment", "sport", "other"],
            default: "other",
        },

        kinds: [{ type: String }],

        description: { type: String, default: "" },

        coordinates: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
        },

        distance_m: { type: Number, default: 0 },

        image_url: { type: String, default: "" },

        wikipedia_url: { type: String, default: "" },

        rating: { type: Number, default: 0, min: 0, max: 3 },

        is_active: { type: Boolean, default: true },

        // admin overrides — shown in API instead of the API-sourced fields when set
        custom_description: { type: String, default: "" },
        
        custom_image_url: { type: String, default: "" },

        last_synced: { type: Date, default: null },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

attractionSchema.index({ category: 1, distance_m: 1 });
attractionSchema.index({ is_active: 1 });

const Attraction = mongoose.models.Attraction || mongoose.model("Attraction", attractionSchema);
export default Attraction;
