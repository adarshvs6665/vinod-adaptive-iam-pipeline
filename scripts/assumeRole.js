import AWS from 'aws-sdk';
const fs = require('fs');
import * as dotenv from 'dotenv';

dotenv.config();

const sts = new AWS.STS();

const policy = {
  Version: "2012-10-17",
  Statement: [{
    Effect: "Allow",
    Action: [
      "s3:GetObject",
      "lambda:UpdateFunctionCode"
    ],
    Resource: [
      `arn:aws:s3:::${process.env.BUCKET_NAME}/*`,
      "*"
    ]
  }]
};

const assumedRole = await sts.assumeRole({
  RoleArn: process.env.ROLE_ARN,
  RoleSessionName: "CI-CD-Session",
  DurationSeconds: 900,
  Policy: JSON.stringify(policy)
}).promise();

fs.writeFileSync(".env.deployment", `
    AWS_ACCESS_KEY_ID=${assumedRole.Credentials.AccessKeyId}
    AWS_SECRET_ACCESS_KEY=${assumedRole.Credentials.SecretAccessKey}
    AWS_SESSION_TOKEN=${assumedRole.Credentials.SessionToken}
`);
