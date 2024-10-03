import asynchandler from "../utils/asynchandlers.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asynchandler(async (req, res) => {
  const { userName, email, fullname, password } = req.body;
  //validation
  if (
    [userName, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //checking user is already exist or not
  const existedUser = await User.findOne({
    $or: [{ userName }, { email }], //checking the user with email or username
  });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exist");
  }
  //checking files
  const avatarLocalPath = req.files?.avatar[0]?.path; //checking the file is uploaded and seeing its localpath exist or not
  //checking cover image is present or not
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  //checking the avatar file exist or not
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  //checking avatar upload on cloudiary or not
  if (!avatar) {
    throw new ApiError(400, "Avatar upload on cloudinary failed");
  }
  const mongoResponse = await User.create({
    //User is  model from user model which can query to db
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  }); //after creating the user the mongo db return all the data which is saved
  //checking user is created or not with finding with id
  const createdUser = await User.findById(mongoResponse._id).select(
    "-password -refreshToken", //deselecting two feilds so they are not returned to frontend
  );

  //now checking the user is created or not
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  //now if everything is fine then return the response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

export { registerUser };
