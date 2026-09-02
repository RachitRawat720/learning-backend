import { asyncHandler } from '../utils/asyncHandler.js'
import { apiError } from '../utils/apiError.js'
import { User } from '../models/user.models.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { apiResponse  } from '../utils/apiResponse.js'
import jwt from 'jsonwebtoken'

// Method for generating Access & Refresh Token

const generateAccessAndRefreshToken = async (userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})   // note
        return { accessToken, refreshToken }

    }catch(error){
        throw new apiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async(req, res) => {
    
    // 1 - get user details from the frontend
    // 2 - validation - not empty
    // 3 - check if user already exists - username, email
    // 4 - check for images, check for avatar
    // 5 - upload them to cloudinary, avatar
    // 6 - create user object, create entry in db
    // 7 - remove password and refresh token field from the response
    // 8 - check for user creation
    // 9 - return response

    // 1 -
    const { fullname, email, username, password } = req.body;
    
    // 2 -
    if([fullname, email, password, username].some((field) =>
        !field || field.trim() === "")
    ){
        throw new apiError(400, "All fields are required")
    }

    // 3 -
    const existedUser = await User.findOne({
        $or: [{ username },{ email}]    // note
    })

    if(existedUser){
        throw new apiError(409, "user with username or email already exists")
    }

    // 4 -
    const avatarLocalPath = req.files?.avatar[0]?.path;  // note
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new apiError(400, "avatar file is required")
    }

    // 5 -
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new apiError(400, "avatar file is required")
    }

    // 6 -
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // 7 -
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"  // remove password & refreshToken
    )

    // 8 -
    if(!createdUser){
        throw new apiError(500, "Something went wrong while registering the user")
    }

    // 9 -
    return res.status(201).json(
        new apiResponse(200, createdUser, "user is registered Successfully")
    )
})

const loginUser = asyncHandler(async(req, res) => {
    
    // 1- req.body -> data
    // 2- username or email
    // 3- find the user
    // 4- check the password
    // 5- if correct generate access and refresh token
    // 6- send cookie

    // 1-
    const {username, email, password } = req.body;

    // 2-
    if(!(username || email)){
        throw new apiError(400, "username or email is required")
    }

    // 3-
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new apiError(404, "User does not exists")
    }

    // 4-
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new apiError(401, "Invalid user credentials")
    }

    // 5-
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findOne(user._id).select("-password -refreshToken")

    // 6-
    const options = {   // note
        httpOnly: true,    // prevents client side JS(like document.cookie) from reading or modifying cookie
        secure: true       // forces the browser to send the cookie back to the server only over encrypted connections(HTTPs)
    }

    res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new apiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "user logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new apiResponse(200, {}, "User logged out")
    )
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new apiError(401, "Unauthorized request")
    }

    try{
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new apiError(401, "Invalid Refresh Token")
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new apiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { newRefreshToken, accessToken } = await generateAccessAndRefreshToken(user._id)
        
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new apiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refreshed successfully"
            )
        )
    }catch(error){
        throw new apiError(401, error?.message || "Invalid refresh token")
    }
})

export { registerUser, loginUser, logoutUser, refreshAccessToken }