import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadImage } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export { registerUser };