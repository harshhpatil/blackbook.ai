import { z } from 'zod'

export const sendOtpSchema = z.object({
    body: z.object({
        mobileNumber: z.string()
            .trim()
            .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
    })
})

export const verifyOtpSchema = z.object({
    body: z.object({
        mobileNumber: z.string()
            .trim()
            .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
    })
})