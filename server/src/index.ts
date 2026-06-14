import 'dotenv/config';
import app from './app.ts';
import { dbConnection } from './config/dbConnection.ts';

const PORT = process.env.PORT;
if (!process.env.PORT) {
  console.error('PORT is not defined in environment variables.');
  process.exit(1);
}

// function to start the server
const startServer = async () => {
  await dbConnection();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
