import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const input = {
  user: { role: process.env.USER_ROLE },
  pipeline: { stage: process.env.PIPELINE_STAGE },
  resource: { environment: process.env.ENVIRONMENT }
};

if (res.data.result === true) {
  console.log("Access granted.");
  process.exit(0);
} else {
  console.error("Access denied.");
  process.exit(1);
}