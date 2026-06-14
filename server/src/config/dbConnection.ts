import mongoose from 'mongoose';

export const dbConnection = async () => {
  // checking if the db connection string is loaded properly or not
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    // checking if mongoose is already connected to the database if connected return without connecting again
    if (mongoose.connection.readyState === 1) {
      console.log('mongodb is already connected.');
      return;
    }

    // connecting to the database
    const conn = await mongoose.connect(process.env.MONGO_URI as string);
    console.log(`mongodb connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('error connecting to mongodb:', err);
    process.exit(1); // stopping the server if db connection fails
  }
};
