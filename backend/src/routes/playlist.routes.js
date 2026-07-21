import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { addVideoToPlaylist, createPlaylist, deletePlaylist, getPlaylistById, getUserPlaylist, removeVideoFromPlaylist, updatePlaylist } from "../controllers/playlist.controller.js";

const router=Router();

router.route("/create").post(verifyJWT,createPlaylist)
router.route("/getplaylist/:userId").get(verifyJWT,getUserPlaylist)
router.route("/getplaylist/:playlistId").get(verifyJWT,getPlaylistById)
router.route("/addvideo/:videoId/:playlistId").post(verifyJWT,addVideoToPlaylist)
router.route("/removevideo/:videoId/:playlistId").post(verifyJWT,removeVideoFromPlaylist)
router.route("/deleteplaylist/:playlistId").get(verifyJWT,deletePlaylist)
router.route("/updateplaylist/:playlistId").patch(verifyJWT,updatePlaylist)

export default router