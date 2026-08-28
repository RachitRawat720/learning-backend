import { asyncHandler } from '../utils/asyncHandler.js'
import { apiError } from '../utils/apiError.js'
import { User } from '../models/user.models.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { apiResponse  } from '../utils/apiResponse.js'

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
    const { fullName, email, username, password } = req.body;
    console.log("email : ", email);
    
    // 2 -
    if([fullName, email, password, username].some((field) =>
        !field || field.trim() === "")
    ){
        throw new apiError(400, "All fields are required")
    }

    // 3 -
    const existedUser = User.findOne({
        $or: [{ username },{ email}]    // note
    })

    if(existedUser){
        throw new apiError(409, "user with username or email already exists")
    }

    // 4 -
    const avatarLocalPath = req.files?.avatar[0]?.path;  // note
    const coverImageLocalPath = req.files?.coverImageLocalPath[0]?.path;

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
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // 7 -
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // 8 -
    if(!createdUser){
        throw new apiError(500, "Something went wrong while registering the user")
    }

    // 9 -

})

export { registerUser }