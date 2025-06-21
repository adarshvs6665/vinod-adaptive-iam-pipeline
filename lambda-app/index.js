const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = async (event) => {
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: 'hello.txt'
  };

  try {
    const data = await s3.getObject(params).promise();
    return {
      statusCode: 200,
      body: data.Body.toString('utf-8'),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: `Error fetching file: ${err.message}`,
    };
  }
};