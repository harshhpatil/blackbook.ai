import { getRedisConnection, getBullRedisConnection } from "../../../core/config/redisConnection.ts";
import crypto from "node:crypto";
import { Queue } from "bullmq";

const smsQueue = new Queue('sms-queue', { connection: getBullRedisConnection() as any });

export const generateOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000);
    return otp.toString();
}

export const storeOtp = async (mobileNumber: string, otp: string): Promise<void> => {
    try {
        const redisConnection = getRedisConnection();
        const EXPIRY_IN_SECONDS = 60 * 5;

        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
        await redisConnection.set(`otp:${mobileNumber}`, hashedOtp, "EX", EXPIRY_IN_SECONDS);

    } catch (err) {
        console.error("Error while storing the otp in the redis", err);
        throw new Error("Failed to store OTP");
    }
}

export const verifyOtp = async (mobileNumber: string, otp: string): Promise<boolean> => {
    try {
        const redisConnection = getRedisConnection();
        const storedOtp = await redisConnection.get(`otp:${mobileNumber}`);
        if (!storedOtp) {
            return false;
        }

        const hashedInputOtp = crypto.createHash('sha256').update(otp).digest('hex');
        const isValidOtp = storedOtp === hashedInputOtp;
        
        if (isValidOtp) {
            // Delete OTP to prevent replay attacks
            await redisConnection.del(`otp:${mobileNumber}`);
        }
        
        return isValidOtp;
    } catch (err) {
        console.error("Error while verifying the otp", err);
        throw new Error("Failed to verify OTP");
    }
}

export const sendOtp = async (mobileNumber: string): Promise<void> => {
    try {
        const otp = generateOtp();
        await storeOtp(mobileNumber, otp);
        
        await smsQueue.add('send-sms', { mobileNumber, otp });
    } catch (err) {
        console.error("Error while sending the otp", err);
        throw new Error("Failed to send OTP");
    }
}