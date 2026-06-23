import Razorpay from 'razorpay';

// checking if the Razorpay key_id and key_secret are provided in the environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error(
    'Razorpay key_id and key_secret must be provided in the environment variables.'
  );
}

// creating an instance of the Razorpay class with the provided key_id and key_secret
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
