#!/bin/bash

# Deploy using AssumeRole and dynamic policy

set -e  # Exit on any error

# Set region explicitly
AWS_REGION=us-east-1
export AWS_REGION
export AWS_DEFAULT_REGION=$AWS_REGION

# Temporary profile name
TMP_PROFILE="tmp-profile"

# Role ARN to assume
ROLE_ARN="arn:aws:iam::784896966975:role/ServerlessDeploymentRole"  # <-- replace this with your actual role ARN

# Check if ENVIRONMENT is set
if [ -z "$ENVIRONMENT" ]; then
    echo "Error: ENVIRONMENT variable is not set"
    echo "Usage: ENVIRONMENT=dev|production ./deploy-with-assume-role.sh"
    exit 1
fi

# Check if required policy file exists
if [ ! -f "output/generated-policy.json" ]; then
    echo "Error: output/generated-policy.json not found. Please run buildPolicy first."
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p output

echo "=== Getting Temporary Credentials via AssumeRole ==="
echo "Assuming role with dynamic policy for $ENVIRONMENT environment..."

# Use AWS profile 'vinod' to assume the role
aws sts assume-role \
    --profile vinod \
    --region "$AWS_REGION" \
    --role-arn "$ROLE_ARN" \
    --role-session-name "deployment-session-$ENVIRONMENT" \
    --policy file://output/generated-policy.json \
    --duration-seconds 900 > output/assume-role-credentials.json

echo "AssumeRole successful"

# Extract credentials
ACCESS_KEY=$(jq -r '.Credentials.AccessKeyId' output/assume-role-credentials.json)
SECRET_KEY=$(jq -r '.Credentials.SecretAccessKey' output/assume-role-credentials.json)
SESSION_TOKEN=$(jq -r '.Credentials.SessionToken' output/assume-role-credentials.json)
EXPIRATION=$(jq -r '.Credentials.Expiration' output/assume-role-credentials.json)

if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" || -z "$SESSION_TOKEN" ]]; then
  echo "Error: Failed to extract temporary credentials from assume-role-credentials.json"
  exit 1
fi

echo "Token expires at: $EXPIRATION"

echo "=== Configuring Temporary AWS Profile ==="
aws configure set aws_access_key_id "$ACCESS_KEY" --profile "$TMP_PROFILE"
aws configure set aws_secret_access_key "$SECRET_KEY" --profile "$TMP_PROFILE"
aws configure set aws_session_token "$SESSION_TOKEN" --profile "$TMP_PROFILE"
aws configure set region "$AWS_REGION" --profile "$TMP_PROFILE"

echo "Temporary profile '$TMP_PROFILE' configured successfully"

echo "=== Verifying Credentials ==="
aws sts get-caller-identity --profile "$TMP_PROFILE" --region "$AWS_REGION"

echo "=== Deploying to $ENVIRONMENT ==="
AWS_PROFILE="$TMP_PROFILE" serverless deploy --stage "$ENVIRONMENT"

echo "Deployment completed successfully!"

echo "=== Cleaning Up ==="
aws configure --profile "$TMP_PROFILE" set aws_access_key_id ""
aws configure --profile "$TMP_PROFILE" set aws_secret_access_key ""
aws configure --profile "$TMP_PROFILE" set aws_session_token ""
aws configure --profile "$TMP_PROFILE" set region ""

if [ -f "output/assume-role-credentials.json" ]; then
    rm -f output/assume-role-credentials.json
    echo "Cleaned up assume role credentials file"
fi

echo "Temporary profile cleaned up successfully"
echo "Script completed!"
