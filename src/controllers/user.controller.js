import asynchandler from "../utils/asynchandlers.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const userDoc = await User.findById(userId);
    const accessToken = userDoc.generateAccessToken();
    const refreshToken = userDoc.generateRefreshToken();
    userDoc.refreshToken = refreshToken;
    await userDoc.save({ validateBeforeSave: false }); //saving the refresh token without invoking the mongoose checking of required feilds
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access or refresh token",
    );
  }
};

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

const loginUser = asynchandler(async (req, res) => {
  //req body -> data
  const { email, userName, password } = req.body;
  //user name or email
  if (!(userName || email)) {
    throw new ApiError(400, "username or password is required");
  }
  //find the user
  const findUser = await User.findOne({
    $or: [{ userName }, { email }],
  });
  if (!findUser) {
    throw new ApiError(404, "User does not exist");
  }

  //check the password
  const isPasswordValid = await findUser.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password is Invalid");
  }

  //create access token and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    findUser._id,
  );

  //sending them to cookie of user
  const loggedInuser = await User.findOne(findUser._id).select(
    "-password -refreshToken",
  );
  const options = {
    httpOnly: true,
    secure: true, //sending cookie securly
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInuser,
          accessToken,
          refreshToken,
        },
        "User logged In successFully",
      ),
    );
});

const logoutUser = asynchandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: null,
      },
    },
    {
      new: true, //getting the new upadated data
    },
  );

  const options = {
    httpOnly: true,
    secure: true, //sending cookie securly
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out success"));
});

const regenerateAccessToken = asynchandler(async (req, res) => {
  const oldAccessToken = req.cookie.accessToken;
  if (!oldAccessToken) {
    throw new ApiError(401, "Unauthorised Request");
  }
  try {
    const decodedToken = await jwt.verify(
      oldAccessToken,
      process.env.ACCESS_TOKEN_SECRET,
    );
    const user = User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid Refresh token");
    }
    if (oldAccessToken !== user?.refreshToken) {
      throw new ApiError(401, "User is unauthorised");
    }
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, newRefreshToken },
          "Access Token refreshed",
        ),
      );
  } catch (error) {
    throw new ApiError(401, error);
  }
});

const changeCurentUserPassword = asynchandler(async (req, res) => {
  const { oldPassword, newPassword, confPassword } = req.body;

  if (!(newPassword === confPassword)) {
    throw new ApiError(400, "Confirm Password doesn't match");
  }

  //after the middleware of auth check we know that the user is present in the request
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old Password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password is changed Successfully"));
});

const getCurrentUser = asynchandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetch success"));
});

const updateUserInfo = asynchandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!(fullname && email)) {
    throw new ApiError(400, "Fullname, email is required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true },
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated"));
});

//if you want to change file make a seprate route
const updateUserAvatar = asynchandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(500, "Error while uploading ");
  }
  const user = await findByIdAndUpdate(
    req.user?._id,
    {
      $set: { avatar: avatar.url },
    },
    { new: true },
  ).select("-password");

  if (!user) {
    throw new ApiError(500, "Error on updating in db");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar update success"));
});

const updateUsercoverImage = asynchandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Please upload cover image");
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(500, "Upload Failed on server");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { coverImage: coverImage.url },
    },
    { new: true },
  ).select("-password");

  if (!user) {
    throw new ApiError(500, "Error saving data on mongo");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image update success"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  regenerateAccessToken,
  changeCurentUserPassword,
  getCurrentUser,
  updateUserInfo,
  updateUserAvatar,
  updateUsercoverImage,
};
