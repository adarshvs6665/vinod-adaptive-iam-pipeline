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

  // Always include CloudFormation and IAM for serverless deployments
  detectedServices.add("cloudformation");
  detectedServices.add("iam");

  // Check for Lambda functions
  if (config.functions && Object.keys(config.functions).length > 0) {
    detectedServices.add("lambda");
  }

  // Check resources section
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

  // Check provider configuration for VPC settings (indicates EC2 usage)
  if (config.provider && config.provider.vpc) {
    detectedServices.add("ec2");
  }

  // Check for DynamoDB tables in provider.environment or iamRoleStatements
  if (config.provider && config.provider.environment) {
    const envVars = Object.values(config.provider.environment);
    envVars.forEach((value) => {
      if (typeof value === "string" && value.includes("dynamodb")) {
        detectedServices.add("dynamodb");
      }
    });
  }

  // Check custom section for additional resources
  if (config.custom) {
    const customStr = JSON.stringify(config.custom).toLowerCase();
    if (customStr.includes("s3")) detectedServices.add("s3");
    if (customStr.includes("dynamodb")) detectedServices.add("dynamodb");
    if (customStr.includes("rds")) detectedServices.add("rds");
    if (customStr.includes("ec2") || customStr.includes("vpc"))
      detectedServices.add("ec2");
  }

  // Note: Serverless Framework uses S3 for deployments, but this is covered by s3:* if S3 is detected

  return Array.from(detectedServices);
}

function generatePolicy(config) {
  const detectedServices = detectServicesFromConfig(config);
  const serviceName = config.service || "serverless-service";
  const stage = config.provider?.stage || "dev";
  const region = config.provider?.region || "us-east-1";
  const accountId = "*"; // We'll use wildcard since we don't know the account ID

  console.log("Detected services:", detectedServices);

  // Collect all permissions
  const allPermissions = new Set();

  detectedServices.forEach((service) => {
    if (servicePermissions[service]) {
      servicePermissions[service].forEach((permission) => {
        allPermissions.add(permission);
      });
    }
  });

  // Generate more specific resource ARNs for better security
  const resources = [];

  detectedServices.forEach((service) => {
    switch (service) {
      case "s3":
        // For S3 resources created by the application
        resources.push(`arn:aws:s3:::${serviceName}-${stage}-*`);
        resources.push(`arn:aws:s3:::${serviceName}-${stage}-*/*`);
        break;
        
      case "lambda":
        // For Lambda functions
        resources.push(`arn:aws:lambda:${region}:${accountId}:function:${serviceName}-${stage}-*`);
        resources.push(`arn:aws:lambda:${region}:${accountId}:layer:${serviceName}-${stage}-*`);
        break;
        
      case "dynamodb":
        // For DynamoDB tables
        resources.push(`arn:aws:dynamodb:${region}:${accountId}:table/${serviceName}-${stage}-*`);
        resources.push(`arn:aws:dynamodb:${region}:${accountId}:table/${serviceName}-${stage}-*/index/*`);
        break;
        
      case "logs":
        // For CloudWatch logs
        resources.push(`arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${serviceName}-${stage}-*`);
        resources.push(`arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${serviceName}-${stage}-*:*`);
        break;
        
      case "cloudformation":
        // For CloudFormation stacks
        resources.push(`arn:aws:cloudformation:${region}:${accountId}:stack/${serviceName}-${stage}/*`);
        resources.push(`arn:aws:cloudformation:${region}:${accountId}:stack/${serviceName}-${stage}-*/*`);
        break;
        
      case "iam":
        // For IAM roles created by serverless
        resources.push(`arn:aws:iam::${accountId}:role/${serviceName}-${stage}-*`);
        resources.push(`arn:aws:iam::${accountId}:role/*-${serviceName}-${stage}-*`);
        break;
        
      case "ec2":
        // For EC2 resources (VPC, Security Groups, etc.)
        resources.push(`arn:aws:ec2:${region}:${accountId}:security-group/*`);
        resources.push(`arn:aws:ec2:${region}:${accountId}:network-interface/*`);
        resources.push(`arn:aws:ec2:${region}:${accountId}:vpc/*`);
        resources.push(`arn:aws:ec2:${region}:${accountId}:subnet/*`);
        break;
        
      case "rds":
        // For RDS resources
        resources.push(`arn:aws:rds:${region}:${accountId}:db:${serviceName}-${stage}-*`);
        resources.push(`arn:aws:rds:${region}:${accountId}:subgrp:${serviceName}-${stage}-*`);
        resources.push(`arn:aws:rds:${region}:${accountId}:pg:${serviceName}-${stage}-*`);
        break;
    }
  });

  // Add wildcard for any missed resources (can be removed for stricter security)
  resources.push("*");

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: Array.from(allPermissions).sort(),
        Resource: [...new Set(resources)], // Remove duplicates
      },
    ],
  };

  return policy;
}

function main() {
  const serverlessConfigPath = process.argv[2] || "./serverless.yml";

  if (!fs.existsSync(serverlessConfigPath)) {
    console.error(`Serverless config file not found: ${serverlessConfigPath}`);
    process.exit(1);
  }

  console.log(`Reading serverless config from: ${serverlessConfigPath}`);

  const config = readServerlessConfig(serverlessConfigPath);
  const policy = generatePolicy(config);

  console.log("\n=== Generated IAM Policy ===");
  console.log(JSON.stringify(policy, null, 2));

  console.log("\n=== Policy Summary ===");
  console.log(`Total Actions: ${policy.Statement[0].Action.length}`);
  console.log(`Total Resources: ${policy.Statement[0].Resource.length}`);

  console.log("\n=== Policy for STS AssumeRole ===");
  console.log("Use this policy object in your STS assumeRole call:");
  console.log(`
const policy = ${JSON.stringify(policy, null, 2)};

// Use in STS assumeRole
const stsParams = {
  RoleArn: process.env.ROLE_ARN,
  RoleSessionName: "CI-CD-Session",
  DurationSeconds: 900,
  Policy: JSON.stringify(policy)
};
`);

  // Ensure output directory exists
  const outputDir = "./output";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save policy to file for easy access
  const outputPath = "./output/generated-policy.json";
  fs.writeFileSync(outputPath, JSON.stringify(policy, null, 2));
  console.log(`\nPolicy saved to: ${outputPath}`);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  generatePolicy,
  readServerlessConfig,
  detectServicesFromConfig,
};