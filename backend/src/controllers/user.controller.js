import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const options={
    httpOnly:true,
    secure:true
}

const generateAccessAndRefreshToken=async (userId)=>{
    try {
        const user=await User.findById(userId)
        const accessToken=await user.generateAccessToken()
        const refreshToken=await user.generateRefreshToken()
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken,refreshToken}
    } catch (error) {
       throw new ApiError(500,"Something went wrong while generating refresh and access token") 
    }
}

const registerUser=asyncHandler(
    async (req,res,next)=>{
        const {fullname,email,username,password} =req.body
        if([fullname,email,username,password]
            .some((field)=>field?.trim()==="")
        ){
            throw new ApiError(400,"All fields are required");
            
        }

        const existedUser=await User.findOne({
            $or:[{username},{email}]
        })

        if(existedUser){
            throw new ApiError(409,"User with username or email already exists")
        }

        const avatarLocalPath=req.files?.avatar[0]?.path
        // const coverImageLocalPath=req.files?.coverImage[0]?.path
        let coverImageLocalPath;
        if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0)
         {
            coverImageLocalPath=req.files.coverImage[0].path
         }
        if(!avatarLocalPath){
            throw new ApiError(400,"Avatar file is required")
        }
         
        const avatar =await uploadOnCloudinary(avatarLocalPath)
        const coverImage =await uploadOnCloudinary(coverImageLocalPath)
  
        if(!avatar){
            throw new ApiError(400,"Avatar file is required")
        }

        const user=await User.create({
            fullname,
            avatar:avatar.url,
            coverImage:coverImage?.url || "",
            email,
            password,
            username
        })

        const createdUser=await User.findById(user._id)
        .select("-password -refreshToken")

        if(!createdUser){
            throw new ApiError(500,"Something went wrong while registering the User!")
        }
        return res.status(201).json(
            new ApiResponse(200,createdUser,"User registered successfully")
        )
    }
)

const loginUser=asyncHandler(async (req,res,next)=>{
    const {username,email,password}=req.body;
    if(!username && !email){
        throw new ApiError(400,"username or email is required!")
    }

    const user=await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exists.")
    }

    const isPasswordValid=await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)
    
    const loggedInUser=await User.findById(user._id)
    .select("-password -refreshToken")

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                loggedInUser,accessToken,refreshToken
            },
            "User Successfully logged in!"
        )
    )
})

const logoutUser=asyncHandler(
    async (req,res)=>{
        await User.findByIdAndUpdate(
            req.user._id,{
                $set:{refreshToken:undefined}
            },
            {
                new:true
            }
        )
       

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200,{},"User logged out !!"))

    }
)

const refreshAccessToken=asyncHandler(
    async (req,res)=>{
        const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken
        if(!incomingRefreshToken){
            throw new ApiError(401,"Unauthorized request:Invalid Refresh Token")
        }
        try {
            const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
            const user=await User.findById(decodedToken._id)
            if(!user){
                throw new ApiError(401,"Invalid Refresh Token")
            }
            if(incomingRefreshToken!==user?.refreshToken){
                throw new ApiError(401,"Refresh Token is expired")
            }
            const {accessToken,newRefreshToken}=await generateAccessAndRefreshToken(user._id)
            return res
            .status(200)
            .cookie("accessToken",accessToken,options)
            .cookie("refreshToken",newRefreshToken,options)
            .json(
                new ApiResponse(
                    200,
                    {
                       accessToken,refreshToken:newRefreshToken
                    },
                    "Access Token Refreshed"
                )
            )
        } catch (error) {
            throw new ApiError(401,error?.message || "Invalid refresh token")
        }
    }
)

const changeCurrentUserPassword=asyncHandler(async (req,res)=>{
    const {oldPassword,newPassword}=req.body
    if(!oldPassword || !newPassword){
        throw new ApiError(400,"Old Password and New Password are required")
    }

    const user=await User.findById(req.user?._id)
    if(!user){
        throw new ApiError(404,"User not found")
    }

    const isPasswordValid=await user.isPasswordCorrect(oldPassword)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid old password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))
} )

const getCurrentUser=asyncHandler(async (req,res)=>{
    return res.status(200)
    .json(
        new ApiResponse(200,req.user,"Current User fetched successfully")
    )
})

const updateAccoutDetails=asyncHandler(async (req,res)=>{
    const {fullname,email}=req.body;
    if(!fullname || !email){
        throw new ApiError(400,"All fields are required.")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{fullname,email}
        },
        {new:true}
    ).select("-password -refreshToken")
    return res.status(200)
    .json(
        new ApiResponse(200,user,"Accounts details updated.")
    )
})

const updateUserAvatar=asyncHandler(async (req,res)=>{
    const avatarLocalPath=req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing.")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on cloudinary.")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{avatar:avatar.url}
        },
        {new:true}
    ).select("-password -refreshToken")
    return res.status(200)
    .json(
        new ApiResponse(200,user,"Avatar  updated successfully.")
    )
})

const updateUserCoverImage=asyncHandler(async (req,res)=>{
    const coverImageLocalPath=req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"coverImage file is missing.")
    }
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on cloudinary.")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{coverImage:coverImage.url}
        },
        {new:true}
    ).select("-password -refreshToken")
    return res.status(200)
    .json(
        new ApiResponse(200,user,"coverImage  updated successfully.")
    )
})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {username}=req.params;
    if(!username?.trim()){
        throw new ApiError(400,"Username is missing")
    }

    const channel=await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:_id,
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:_id,
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelSubscribeToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id , "$subscriders.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscribersCount:1,
                channelSubscribeToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ]);
    if(!channel?.length){
        throw new ApiError(404,"Channel does not exists")
    }
    return res.status(200)
    .json(
        new ApiResponse(
            200,
            channel[0],
            "User channel successfully fetched"
        )
    )
})

const getUserWatchHistory=asyncHandler(async(req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"-id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                $first:"$owner"
            }
        }
    ])
    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "WatchHistory fetched successfully"
        )
    )
})

export {
    registerUser,
    loginUser ,
    logoutUser,
    refreshAccessToken,
    changeCurrentUserPassword,
    getCurrentUser,
    updateAccoutDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getUserWatchHistory
}