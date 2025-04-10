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

const changeCurrentPassword = asyncHandler(async (req, res) => {
    // get user id from req.user
    // get password from body
    // check if the user exists
    // check if the password is valid
    // hash the password
    // update the password in the database
    // return response to the frontend

    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findById(req.user._id)
    const isPasswordCorrect = await user.matchPassword(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid password")
    }
    user.password = newPassword
    await user.save(validateBeforeSave = false)

    return res.status(200)
        .json(
            new ApiResponse(200, {}, "Password changed successfully")
        )
})

const getCurrentUser = asyncHandler(async (req, res) => {

    return res.
        status(200)
        .json(
            new ApiResponse(200, req.user, "User fetched successfully")
        )
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    // get user id from req.user
    // get user details from body
    // check if the user exists
    // update the user details in the database
    // return response to the frontend

    const { fullName, email } = req.body
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }
    ).select("-password")

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    user.fullName = fullName
    user.email = email

    await user.save()

    return res.status(200)
        .json(
            new ApiResponse(200, {}, "Account details updated successfully")
        )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req?.files?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadImage(avatarLocalPath)
    if (!avatar) {
        throw new ApiError(400, "error while uploading  avatar");
    }

    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            avatar: avatar?.url
        }
    }, { new: true }).select("-password")
    return res.status(200)
        .json(
            new ApiResponse(200, avatar, "Avatar updated successfully")
        )
})


const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req?.files?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "cover image is required");
    }

    const coverImage = await uploadImage(coverImageLocalPath)
    if (!coverImage) {
        throw new ApiError(400, "error while uploading  cover image");
    }

    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            avatar: coverImage?.url
        }
    }, { new: true }).select("-password")

    return res.status(200)
        .json(
            new ApiResponse(200, coverImage, "Cover image updated successfully")
        )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params
    if (!username) {
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user._id, "$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                avatar: 1,
                coverImage: 1,
                isSubscribed: 1,
                email: 1,

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "Channel profile fetched successfully")
        )
})

const getWatchHistory = asyncHandler(async (res, req) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.objectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
})

return res
    .status
    .json(
        new ApiResponse(200, user[0]?.watchhistory,
            "watch history fetched successfully"
        )
    )

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}