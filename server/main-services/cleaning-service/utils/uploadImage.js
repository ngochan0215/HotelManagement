import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../../../shared/config/cloudinary.js";

const cleaningTaskStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "cleaning_tasks",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
    },
});

export const uploadCleaningImages = multer({
    storage: cleaningTaskStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
});
