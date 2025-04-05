import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadImage } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens")

    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from the frontend
    //validatate the user details
    // check if the user already exists : username or email
    // check for images , check for avatar
    // upload images to cloudinary,
    // create user object - create entry in database
    // remove password and refresh token fields from response
    // check for user creation
    // return response to the frontend


    const { fullName, email, username, password } = req.body;
    console.log("email", email);
    // if (fullName === "") {
    //     throw new ApiError(400, "Full name is required");
    // }

    if ([fullName, email, username, password].some(field => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [
            { email },
            { username }
        ]
    })

    if (existedUser) {
        throw new ApiError(400, "User already exists");
    }
    const avatarLocalPath = req?.files?.avatar?.[0]?.path || null;
    const coverImageLocalPath = req?.files?.coverImage?.[0]?.path || null;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadImage(avatarLocalPath)
    const coverImage = await coverImageLocalPath ? await uploadImage(coverImageLocalPath) : null;

    if (!avatar) {
        throw new ApiError(400, "Avatar is required");
    }

    const user = await User.create({
        fullName,
        avatar: avatar?.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),

    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while creating user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully")
    )

});

const loginUser = asyncHandler(async (req, res) => {
    // get body from frontend
    //username or email and password
    //find user in the database
    //password check
    //access token generation refresh token generation
    //send cookies to the frontend

    const { username, email, password } = req.body;
    if (!username && !email) {
        throw new ApiError(400, "Username or email is required")
    }
    if (!password) {
        throw new ApiError(400, "Password is required")
    }

    const user = await User.findOne({
        $or: [
            { email },
            { username }
        ]
    })

    if (!user) {
        throw new ApiError(404, "user not found")
    }

    const isPassworldValid = await user.matchPassword(password)
    if (!isPassworldValid) {
        throw new ApiError(401, "Invalid password")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken")

    const option = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, option)
        .cookie("accessToken", accessToken, option)
        .json(
            new ApiResponse(200,
                {
                    user: loggedInUser, accessToken,
                    refreshToken
                },
                "User logged in successfully")
        )
})
const logoutUser = asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(req.user._id,
        {
            $set: { refreshToken: undefined }
        },
        { new: true }
    )

    const option = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("refreshToken", option)
        .clearCookie("accessToken", option)
        .json(
            new ApiResponse(200, null, "User logged out successfully"))

});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken._id)

        if (!user) {
            throw new ApiError(401, "invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "invalid refresh token")
        }

        const option = {
            httpOnly: true,
            secure: true,
        }
        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
        return res
            .status(200)
            .cookie("refreshToken", refreshToken, option)
            .cookie("accessToken", accessToken, option)
            .json(
                new ApiResponse(200,
                    {
                        accessToken,
                        refreshToken
                    },
                    "Access token refreshed successfully")
            )
    } catch (error) {
        throw new ApiError(401, error.message || "unauthorized request")

    }
})

export { registerUser, loginUser, logoutUser, refreshAccessToken }