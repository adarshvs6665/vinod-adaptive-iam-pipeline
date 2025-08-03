const fs = require("fs");
const yaml = require("js-yaml");

const servicePermissions = require("../data/resourceMap.json");

function readServerlessConfig(filePath = "./serverless.yml") {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    return yaml.load(fileContent);
  } catch (error) {
    console.error("Error reading serverless.yml:", error.message);
    process.exit(1);
  }
}

function detectServicesFromConfig(config) {
  const detectedServices = new Set();

  // include these by default as it is required for serverless deployment
  detectedServices.add("cloudformation");
  detectedServices.add("apigateway");
  detectedServices.add("iam");
  detectedServices.add("sts");

  // functions
  if (config.functions && Object.keys(config.functions).length > 0) {
    detectedServices.add("lambda");
  }

  // resources
  if (config.resources && config.resources.Resources) {
    const resources = config.resources.Resources;

    Object.values(resources).forEach((resource) => {
      if (resource.Type) {
        if (resource.Type.startsWith("AWS::S3::")) {
          detectedServices.add("s3");
        } else if (resource.Type.startsWith("AWS::DynamoDB::")) {
          detectedServices.add("dynamodb");
        } else if (resource.Type.startsWith("AWS::EC2::")) {
          detectedServices.add("ec2");
        } else if (resource.Type.startsWith("AWS::RDS::")) {
          detectedServices.add("rds");
        } else if (resource.Type.startsWith("AWS::Lambda::")) {
          detectedServices.add("lambda");
        }
      }
    });
  }

  // ec2
  if (config.provider && config.provider.vpc) {
    detectedServices.add("ec2");
  }

  // dynamodb
  if (config.provider && config.provider.environment) {
    const envVars = Object.values(config.provider.environment);
    envVars.forEach((value) => {
      if (typeof value === "string" && value.includes("dynamodb")) {
        detectedServices.add("dynamodb");
      }
    });
  }

  // checking custom section
  if (config.custom) {
    const customStr = JSON.stringify(config.custom).toLowerCase();
    if (customStr.includes("s3")) detectedServices.add("s3");
    if (customStr.includes("dynamodb")) detectedServices.add("dynamodb");
    if (customStr.includes("rds")) detectedServices.add("rds");
    if (customStr.includes("ec2") || customStr.includes("vpc"))
      detectedServices.add("ec2");
  }

  return Array.from(detectedServices);
}

function generatePolicy(config) {
  const detectedServices = detectServicesFromConfig(config);
  const serviceName = config.service || "serverless-service";
  const stage = config.provider?.stage || "dev";
  const region = config.provider?.region || "us-east-1";
  const accountId = "*";

  console.log("Detected services:", detectedServices);

  const allPermissions = new Set();

  detectedServices.forEach((service) => {
    if (servicePermissions[service]) {
      servicePermissions[service].forEach((permission) => {
        allPermissions.add(permission);
      });
    }
  });

  const resources = [];

  detectedServices.forEach((service) => {
    switch (service) {
      case "s3":
        resources.push(`arn:aws:s3:::${serviceName}-${stage}-*`);
        resources.push(`arn:aws:s3:::${serviceName}-${stage}-*/*`);
        break;
      case "lambda":
        resources.push(
          `arn:aws:lambda:${region}:${accountId}:function:${serviceName}-${stage}-*`
        );
        resources.push(
          `arn:aws:lambda:${region}:${accountId}:layer:${serviceName}-${stage}-*`
        );
        break;
      case "dynamodb":
        resources.push(
          `arn:aws:dynamodb:${region}:${accountId}:table/${serviceName}-${stage}-*`
        );
        resources.push(
          `arn:aws:dynamodb:${region}:${accountId}:table/${serviceName}-${stage}-*/index/*`
        );
        break;
      case "logs":
        resources.push(
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${serviceName}-${stage}-*`
        );
        resources.push(
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${serviceName}-${stage}-*:*`
        );
        break;
      case "cloudformation":
        resources.push(
          `arn:aws:cloudformation:${region}:${accountId}:stack/${serviceName}-${stage}/*`
        );
        resources.push(
          `arn:aws:cloudformation:${region}:${accountId}:stack/${serviceName}-${stage}-*/*`
        );
        break;
      case "iam":
        resources.push(
          `arn:aws:iam::${accountId}:role/${serviceName}-${stage}-*`
        );
        resources.push(
          `arn:aws:iam::${accountId}:role/*-${serviceName}-${stage}-*`
        );
        break;
      case "ec2":
        resources.push(`arn:aws:ec2:${region}:${accountId}:security-group/*`);
        resources.push(
          `arn:aws:ec2:${region}:${accountId}:network-interface/*`
        );
        resources.push(`arn:aws:ec2:${region}:${accountId}:vpc/*`);
        resources.push(`arn:aws:ec2:${region}:${accountId}:subnet/*`);
        break;
      case "rds":
        resources.push(
          `arn:aws:rds:${region}:${accountId}:db:${serviceName}-${stage}-*`
        );
        resources.push(
          `arn:aws:rds:${region}:${accountId}:subgrp:${serviceName}-${stage}-*`
        );
        resources.push(
          `arn:aws:rds:${region}:${accountId}:pg:${serviceName}-${stage}-*`
        );
        break;
    }
  });

  // for any missed resources
  resources.push("*");

  // policy object is created
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: Array.from(allPermissions).sort(),
        Resource: [...new Set(resources)],
      },
    ],
  };

  return policy;
}

function main() {
  const serverlessConfigPath = process.argv[2] || "./serverless.yml";

  if (!fs.existsSync(serverlessConfigPath)) {
    console.error(`serverless.yml not found`);
    process.exit(1);
  }

  console.log(`Reading serverless.yml`);

  const config = readServerlessConfig(serverlessConfigPath);
  const policy = generatePolicy(config);

  const outputDir = "./output";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // save policy to generated-policy.json
  const outputPath = "./output/generated-policy.json";
  fs.writeFileSync(outputPath, JSON.stringify(policy, null, 2));
  console.log(`\nPolicy saved to: ${outputPath}`);
}

main();
