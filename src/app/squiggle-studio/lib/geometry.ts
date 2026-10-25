// The band maths live in the motion-studio runtime so an exported animation
// can draw a rainbow trail without depending on this tool. Re-exported here
// so the studio's imports read naturally.
export { bands, bbox, curve, densify, offset, resample, smoothPts } from "@/app/components/motion-studio/engine/rainbow";
