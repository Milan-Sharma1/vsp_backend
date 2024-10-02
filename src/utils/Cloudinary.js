import { v2 as cloudinary } from "cloudinary";
import fs from "fs"; //file system for nodejs //file read write remove operations

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//uploading

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //uploading on cloudinary
    const cloudinaryResponse = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    //file has been uploaded succesfull
    console.log("File is uploaded on cloudinay url: ", cloudinaryResponse.url);
    return cloudinaryResponse;
  } catch (error) {
    fs.unlinkSync(localFilePath); //remove the locally saved temp file as the upload oper. got failed
    console.log(error);
    return null;
  }
};

export { uploadOnCloudinary };
