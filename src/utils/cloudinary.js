import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

/////////////////////////
// Uploads an image file
/////////////////////////
const uploadImage = async (localFilePath) => {

    try {
        if (!localFilePath) { return null; }
        // Upload the image
        const result = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        console.log("Image uploaded to Cloudinary:", result.url);
        return result;

    } catch (error) {
        fs.unlinkSync(localFilePath); // Delete the file if upload fails
        console.error("Error uploading image to Cloudinary:", error);
        return null;
    }
};

export { uploadImage };