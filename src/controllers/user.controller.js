import asynchandler from "../utils/asynchandlers.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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
    cloudinaryPublicId: [avatar.public_id, coverImage?.public_id],
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  }); //after creating the user the mongo db return all the data which is saved
  //checking user is created or not with finding with id
  const createdUser = await User.findById(mongoResponse._id).select(
    "-password -refreshToken -cloudinaryPublicId", //deselecting two feilds so they are not returned to frontend
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
    "-password -refreshToken -cloudinaryPublicId",
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
  //deleting old avatar
  const oldAvatarPublicId = await User.findById(req.user?._id);
  if (!oldAvatarPublicId) {
    throw new ApiError(505, "old avatar fetch fail");
  }
  const response = await deleteOnCloudinary(
    oldAvatarPublicId.cloudinaryPublicId[0],
  );
  if (!response) {
    throw new ApiError(500, "Old avatar delete failed on cloudinary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
        "cloudinaryPublicId.0": avatar.public_id,
      },
    },
    { new: true },
  ).select("-password -cloudinaryPublicId");

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
  //deleting old coverImg
  const oldCovImgPublicId = await User.findById(req.user?._id);
  if (!oldCovImgPublicId) {
    throw new ApiError(505, "old oldCovImg fetch fail");
  }
  const response = await deleteOnCloudinary(
    oldCovImgPublicId.cloudinaryPublicId[1],
  );
  if (!response) {
    throw new ApiError(500, "Old covImg delete failed on cloudinary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
        "cloudinaryPublicId.1": coverImage.public_id,
      },
    },
    { new: true },
  ).select("-password -cloudinaryPublicId");

  if (!user) {
    throw new ApiError(500, "Error saving data on mongo");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image update success"));
});

const getUserChannelProfile = asynchandler(async (req, res) => {
  const { userName } = req.params;
  if (!userName.trim()) {
    throw new ApiError(400, "userName is missing");
  }
  const channel = await User.aggregate([
    {
      $match: { userName: userName?.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscriptions", //in db by default all schema names will be in lower case and plural
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        subscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        //add fields after getting the values
        fullname: 1, //1 represent that this field added to the channel
        userName: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully"),
    );
});

const getWatchHistory = asynchandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(String(req.user?._id)),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          // the video model has owner field so we are using sub pipline after the lookup field
          {
            // so that we can correctly fetch video with its owner
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner", //the lookup will select whole user model so
              pipeline: [
                //we are using project as another subpipline to select only neccessary field
                {
                  $project: {
                    userName: 1,
                    fullname: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            //after the result of second lookup we get value in an array on its first or zero index
            $addFields: {
              // so we are further using add field operator to overwrite the owner field
              owner: {
                $first: "$owner", // we are accessing the first field of the array using first operator in mongo
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, user[0].watchHistory, "Watch History Fetch Success"),
    );
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
  getUserChannelProfile,
  getWatchHistory,
};
