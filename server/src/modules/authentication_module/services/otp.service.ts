import { getRedisConnection } from "../../../core/config/redisConnection.ts";
import argon2 from "argon2";

export const generateOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000);
    return otp.toString();
}

export const storeOtp = async (mobileNumber: string, otp: string): Promise<void> => {
    try {
        const redisConnection = getRedisConnection();
        const EXPIRY_IN_SECONDS = 60 * 5;

        const hashedOtp = await argon2.hash(otp);
        await redisConnection.set(`otp:${mobileNumber}`, hashedOtp, "EX", EXPIRY_IN_SECONDS, "NX");

    } catch (err) {
        console.log("Error while storing the otp in the redis", err)
    }
}

export const verifyOtp = async (mobileNumber: string, otp: string): Promise<boolean> => {
    try {
        const redisConnection = getRedisConnection();
        const storedOtp = await redisConnection.get(`otp:${mobileNumber}`);
        if (!storedOtp) {
            return false;
        }

        const isValidOtp = await argon2.verify(storedOtp, otp)
        return isValidOtp

    } catch (err) {
        console.log("Error while verifying the otp", err);
        return false;
    }
}

export const sendOtp = async (mobileNumber: string) => {
    try {
        const otp = generateOtp();
        await storeOtp(mobileNumber, otp);
        await queueOtpSendJob(mobileNumber, otp);
    } catch (err) {
        console.log("Error while sending the otp", err);
    }
}