import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import asynchandler from "../utils/asynchandlers.js";
import jwt from "jsonwebtoken";
export const verifyJWT = asynchandler(async (req, _, next) => {
  //respond has no use here so we are using _
  try {
    const token =
      req.cookies.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = await jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshTokens -cloudinaryPublicId",
    );

    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }
    req.user = user; //adding user object in request
    next(); //now move to next
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access token");
  }
});
