import { Worker, Job, ConnectionOptions } from "bullmq"
import { getBullRedisConnection } from "../../../core/config/redisConnection.ts"
import { env } from "../../../core/config/env.ts"
import twilio from "twilio"

interface ISmsJobData {
    mobileNumber: string;
    otp: string;
}


const twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

const sendSmsViaProvider = async (mobileNumber: string, otp: string) => {

    const messageBody = `Your verification code is ${otp}. Valid for 5 minutes.`;

    // Ensure your frontend passes the E.164 format (e.g., +919876543210) for Twilio
    const formattedNumber = mobileNumber.startsWith('+') ? mobileNumber : `+91${mobileNumber}`;

    try {
        const message = await twilioClient.messages.create({
            body: messageBody,
            from: env.TWILIO_PHONE_NUMBER ?? '', // Your verified Twilio Number or Messaging Service SID
            to: formattedNumber
        });

        // Twilio statuses: 'queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered'
        if (message.status === 'failed') {
            throw new Error(`Twilio delivery failed with error code: ${message.errorCode}`);
        }

        console.log(`[Twilio Success] Message SID: ${message.sid} dispatched to ${formattedNumber}`);
    } catch (error: any) {
        // Intercept Twilio specific API errors to pass clean messages up to BullMQ
        console.error('[Twilio API Error] Details:', {
            code: error.code,       // Twilio error code (e.g., 21211 for invalid number)
            message: error.message,
            status: error.status
        });

        // Throwing lets BullMQ automatically schedule an exponential backoff retry
        throw new Error(`Twilio Gateway Exception: ${error.message}`);
    }

}

const smsWorker = new Worker<ISmsJobData>(
    'sms-queue',
    async (job: Job<ISmsJobData>) => {
        const { mobileNumber, otp } = job.data;

        console.log(`[Worker][SMS]: Attempting to send OTP ${otp} to ${mobileNumber}`)

        if (!mobileNumber || !otp) {
            throw new Error(" malformed job payload")
        }


        await sendSmsViaProvider(mobileNumber, otp);
    },
    {
        connection: getBullRedisConnection() as unknown as ConnectionOptions, // Plugs directly into your existing global configuration
        concurrency: 5,              // Number of parallel SMS jobs this worker can process
        limiter: {
            max: 10,                 // Rate-limit protections to match your vendor's tier
            duration: 1000           // Do not exceed 10 API calls per 1000 milliseconds
        }
    }
)

smsWorker.on('completed', (job: Job) => {
    console.log(`[Worker Success] Job #${job.id} dispatched successfully.`);
});

smsWorker.on('failed', (job: Job | undefined, error: Error) => {
    console.error(`[Worker Failure] Job #${job?.id} failed with reason: ${error.message}`);
    // Target metrics or Alert systems (Sentry / Datadog) should trigger here
});

smsWorker.on('error', (err: Error) => {
    console.error('[Worker Critical] A global connection or Redis error occurred:', err);
});

export default smsWorker;
