# Adaptive IAM CI/CD Pipeline Documentation

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Components](#components)
- [Security Model](#security-model)
- [Setup and Installation](#setup-and-installation)
- [Usage](#usage)
- [Pipeline Stages](#pipeline-stages)
- [Configuration](#configuration)
- [File Structure](#file-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

The Adaptive IAM CI/CD Pipeline is a security-first deployment solution that implements **dynamic least privilege access control** for serverless applications. Instead of using static, overly-permissive IAM policies, this pipeline analyzes your code and infrastructure configuration to generate minimal IAM policies on-the-fly during deployment.

### Key Benefits
- **Zero Trust Security**: No permanent broad permissions
- **Dynamic Policy Generation**: Policies tailored to actual resource usage
- **Role-Based Access Control**: Multi-tier user authorization system
- **Code-Driven Security**: Infrastructure security derived from code analysis
- **Temporary Credentials**: Short-lived, scope-limited AWS credentials

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Developer     │    │    Jenkins      │    │      AWS        │
│   Commits Code  │───▶│    Pipeline     │───▶│   Deployment    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Security Controls  │
                    │  ┌───────────────┐  │
                    │  │ Context Check │  │
                    │  │ (OPA Policy)  │  │
                    │  ├───────────────┤  │
                    │  │ Code Analysis │  │
                    │  │ & Policy Gen  │  │
                    │  ├───────────────┤  │
                    │  │ Assume Role   │  │
                    │  │ w/ Min Policy │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
```

## Key Features

### 1. **Dynamic Policy Generation**
- Analyzes `serverless.yml` configuration
- Detects AWS services in use
- Generates minimal IAM policies
- Creates service-specific resource ARNs

### 2. **Context-Aware Authorization**
- Git-based user identification
- Role-based environment access
- Branch and commit analysis
- OPA (Open Policy Agent) policy evaluation

### 3. **Temporary Credential Management**
- AWS STS AssumeRole with inline policies
- 15-minute credential lifetime
- Session-specific naming
- Automatic credential cleanup

### 4. **Multi-Environment Support**
- Development and production environments
- Environment-specific resource naming
- Stage-aware policy generation

## Components

### Core Scripts

#### 1. **buildPolicy.js**
**Purpose**: Analyzes serverless configuration and generates dynamic IAM policies

**Key Functions**:
- `readServerlessConfig()`: Parses serverless.yml file
- `detectServicesFromConfig()`: Identifies AWS services in use
- `generatePolicy()`: Creates minimal IAM policy JSON

**Service Detection Logic**:
- Functions → Lambda permissions
- Resources section → Service-specific permissions
- VPC config → EC2 permissions
- Environment variables → Service hints
- Custom sections → Additional service detection

#### 2. **detectContext.js**
**Purpose**: Extracts deployment context for authorization decisions

**Context Elements**:
- User email (from Git commit)
- User role (mapped from email)
- Git branch
- Target environment

#### 3. **deployment.rego**
**Purpose**: OPA policy for deployment authorization

**Authorization Rules**:
- Admin: Can deploy to dev and prod
- DevOps: Can deploy to dev and prod  
- QA: Can only deploy to dev
- Others: No deployment access

### Configuration Files

#### 4. **resourceMap.json**
Maps AWS services to required IAM permissions:
```json
{
  "lambda": ["lambda:*", "logs:*"],
  "s3": ["s3:*"],
  "dynamodb": ["dynamodb:*"],
  "cloudformation": ["cloudformation:*"],
  "iam": ["iam:*"],
  "sts": ["sts:*"],
  "apigateway": ["apigateway:*"]
}
```

#### 5. **serverless.yml**
Standard Serverless Framework configuration with:
- Service definition
- Provider settings
- Function definitions
- Resource declarations
- Custom variables

## Security Model

### Principle of Least Privilege
1. **Static Analysis**: Code is analyzed to determine required AWS services
2. **Dynamic Policy**: IAM policy generated based on actual needs
3. **Temporary Access**: Credentials valid for 15 minutes only
4. **Scope Limitation**: Policies restricted to specific service/stage resources

### Multi-Layer Authorization
1. **User Identity**: Git commit email-based identification
2. **Role Mapping**: Email to role association
3. **Policy Evaluation**: OPA rule-based authorization
4. **Environment Gating**: Role-specific environment access

### Resource Isolation
- Service-specific ARN patterns
- Stage-based resource naming
- Account-scoped permissions
- Regional resource restrictions

## Setup and Installation

### Prerequisites
- AWS Account with appropriate base permissions
- EC2 instance (minimum t3.small)
- Git repository access
- Jenkins server

### Infrastructure Setup

#### 1. **EC2 Instance Setup**
```bash
# Launch EC2 instance (t3.small or larger)
# Connect via SSH

# Install Git
sudo yum install git -y

# Install Java
sudo yum install java-17-amazon-corretto -y
```

#### 2. **Jenkins Installation**
```bash
# Add Jenkins repository
sudo wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io.key

# Update and install Jenkins
sudo yum upgrade -y
sudo yum install jenkins -y

# Start Jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins
sudo systemctl status jenkins
```

#### 3. **Security Group Configuration**
- Allow inbound traffic on port 8080
- Source: Your IP or 0.0.0.0/0 (less secure)

#### 4. **Jenkins Configuration**
1. Access Jenkins UI: `http://your-ec2-ip:8080`
2. Complete initial setup wizard
3. Install required plugins:
   - Blue Ocean
   - Pipeline
   - GitHub Pipeline
   - AWS Credentials
   - NodeJS

#### 5. **Tool Configuration**
```
Manage Jenkins > Tools > NodeJS Installations
- Name: nodejs (must match Jenkinsfile)
- Install automatically: Latest LTS
```

#### 6. **AWS Credentials Setup**
```
Manage Jenkins > Credentials > Global > Add Credentials
- Kind: AWS Credentials
- ID: aws-credentials
- Access Key ID: [Your AWS Access Key]
- Secret Access Key: [Your AWS Secret Key]
```

### AWS IAM Setup

#### 1. **Create Deployment Role**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR-ACCOUNT:user/YOUR-JENKINS-USER"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

#### 2. **Attach Broad Permissions to Role**
The role should have comprehensive AWS permissions as the dynamic policy will restrict actual access.

### Pipeline Setup

#### 1. **Create Pipeline Job**
```
Jenkins Dashboard > New Item > Pipeline
- Name: adaptive-iam-pipeline
- Pipeline script from SCM
- Repository URL: https://github.com/your-username/your-repo.git
- Branch: main
- Script Path: Jenkinsfile
```

## Usage

### Deployment Process

#### 1. **Trigger Deployment**
```
Jenkins Dashboard > adaptive-iam-pipeline > Build with Parameters
- Select Environment: dev or production
- Click Build
```

#### 2. **Monitor Pipeline**
- View real-time logs in Jenkins console
- Check Blue Ocean for visual pipeline status
- Monitor AWS CloudFormation for deployment progress

### User Role Management

#### 1. **Add New Users**
Edit `detectContext.js`:
```javascript
const getUserRole = (email) => {
  const roleMap = {
    "devops@gmail.com": "devops",
    "qa@gmail.com": "qa", 
    "admin@gmail.com": "admin",
    "newuser@company.com": "devops"  // Add new user
  };
  return roleMap[email] || "none";
};
```

#### 2. **Update Authorization Rules**
Edit `deployment.rego`:
```rego
# Add new rules for different roles/environments
allow if {
    input.userRole == "developer"
    input.environment == "dev"
    input.branch == "feature/*"
}
```

## Pipeline Stages

### Stage 1: **Pull Main**
Clones the latest code from the main branch to ensure consistent codebase for analysis.

```groovy
git branch: 'main', url: 'https://github.com/adarshvs6665/vinod-adaptive-iam-pipeline.git'
```

### Stage 2: **Install Dependencies**
Sets up the runtime environment with all required tools and dependencies. Key installations include:

```bash
npm install -g serverless@3
curl -L -o $HOME/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64
```

Downloads OPA binary to `$HOME/bin` for policy evaluation and installs Serverless Framework v3 globally. Also installs npm dependencies for both root and lambda-app directories.

### Stage 3: **Extract Context**
Extracts deployment context from Git and environment variables for authorization decisions.

```bash
npm run detectContext
```

This runs `detectContext.js` which executes Git commands to gather user information:
```javascript
git rev-parse --abbrev-ref HEAD  // Get current branch
git log -1 --pretty=format:'%ce' // Get last committer email
```

Maps the committer email to roles (admin/devops/qa/none) and creates `output/detected-context.json` with user context.

### Stage 4: **Evaluate Context**
Uses OPA (Open Policy Agent) to evaluate deployment authorization based on extracted context.

```bash
opa eval --data ./rules/deployment.rego --input ./output/detected-context.json --format raw "data.deployment.allow"
```

The OPA evaluation checks user role against target environment using rules in `deployment.rego`. Returns `true`/`false` and pipeline fails immediately if authorization is denied.

### Stage 5: **Generate Dynamic Policy**
Analyzes serverless configuration and generates minimal IAM policy based on detected AWS services.

```bash
npm run buildPolicy
```

The script parses `serverless.yml` and detects services:
```javascript
if (config.functions && Object.keys(config.functions).length > 0) {
    detectedServices.add("lambda");
}
if (resource.Type.startsWith("AWS::S3::")) {
    detectedServices.add("s3");
}
```

Generates service-specific ARN patterns and minimal permission sets, saving the policy to `output/generated-policy.json`.

### Stage 6: **Generate Dynamic Permissions**
Uses AWS STS AssumeRole with the generated policy to create temporary, least-privilege credentials.

```bash
aws sts assume-role --role-arn "arn:aws:iam::ACCOUNT:role/ServerlessDeploymentRole" \
    --role-session-name "deployment-session-${ENVIRONMENT}" \
    --policy file://output/generated-policy.json \
    --duration-seconds 900
```

Extracts temporary credentials and configures AWS profile:
```bash
aws configure set aws_access_key_id "$ACCESS_KEY" --profile "tmp-profile"
aws configure set aws_session_token "$SESSION_TOKEN" --profile "tmp-profile"
```

Creates 15-minute temporary credentials with the generated policy as an inline restriction.

### Stage 7: **Deploy**
Deploys the serverless application using temporary, least-privilege credentials.

```bash
export AWS_PROFILE="tmp-profile"
serverless deploy --stage "${ENVIRONMENT}"
```

Uses the temporary AWS profile created in the previous stage. All AWS API calls are made with minimal, time-limited permissions that match exactly what the code requires.

## Configuration

### Environment Variables
```bash
ENVIRONMENT=dev|production  # Target deployment environment
AWS_REGION=us-east-1       # AWS region for deployment
AWS_DEFAULT_REGION=us-east-1
```

### Key Configuration Files

#### package.json Scripts
```json
{
  "scripts": {
    "detectContext": "node scripts/detectContext.js",
    "buildPolicy": "node scripts/buildPolicy.js"
  }
}
```

#### Serverless Framework Configuration
```yaml
service: adaptive-iam-service
frameworkVersion: '3'
provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}
```

## File Structure

```
adaptive-iam-pipeline/
├── data/
│   ├── resourceMap.json          # Service to permission mapping
│   └── resourceMapDetailed.json  # Extended permission details
├── lambda-app/
│   ├── index.js                  # Lambda function code
│   ├── package.json              # Lambda dependencies
│   └── package-lock.json
├── output/                       # Generated files (created at runtime)
│   ├── detected-context.json     # User/deployment context
│   ├── generated-policy.json     # Dynamic IAM policy
│   └── assume-role-credentials.json # Temporary AWS credentials
├── rules/
│   └── deployment.rego           # OPA authorization policy
├── scripts/
│   ├── buildPolicy.js            # Policy generation logic
│   └── detectContext.js          # Context extraction logic
├── Jenkinsfile                   # Jenkins pipeline definition
├── serverless.yml               # Serverless Framework config
├── package.json                 # Project dependencies
└── package-lock.json
```

## Troubleshooting

### Common Issues

#### 1. **OPA Command Not Found**
```bash
# Check if OPA is in PATH
echo $PATH
ls -la $HOME/bin/opa

# Manual installation
mkdir -p $HOME/bin
curl -L -o $HOME/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64
chmod +x $HOME/bin/opa
```

#### 2. **AWS Credentials Issues**
```bash
# Verify Jenkins AWS credentials
aws sts get-caller-identity

# Check assume role permissions
aws sts assume-role --role-arn "arn:aws:iam::ACCOUNT:role/ROLE" --role-session-name "test"
```

#### 3. **Policy Generation Failures**
- Verify `serverless.yml` syntax
- Check if all required services are in `resourceMap.json`
- Ensure output directory exists and is writable

#### 4. **Authorization Failures**
- Check user email in Git configuration
- Verify role mapping in `detectContext.js`
- Review OPA policy rules in `deployment.rego`

#### 5. **Deployment Failures**
- Verify temporary credentials are valid
- Check CloudFormation events in AWS Console
- Ensure target environment resources don't conflict

### Debug Mode

Enable verbose logging:
```bash
# Add to Jenkinsfile stages
sh 'npm run detectContext -- --verbose'
sh 'npm run buildPolicy -- --debug'
```

### Log Locations
- Jenkins Console Output: Available in Jenkins UI
- AWS CloudFormation: AWS Console > CloudFormation > Events
- OPA Evaluation: Included in Jenkins console output

## Security Considerations

### Best Practices
1. **Regularly rotate AWS access keys**
2. **Use least-privilege base IAM policies**
3. **Monitor CloudTrail logs for unusual activity**
4. **Review and update authorization rules regularly**
5. **Implement branch protection rules**

### Limitations
1. **Bootstrap permissions required**: Initial setup needs broad IAM permissions
2. **Service coverage**: Only includes commonly used AWS services
3. **Policy complexity**: Very complex serverless configs might need manual review
4. **Git dependency**: Relies on Git for user identification

## Contributing

### Adding New AWS Services

1. **Update resourceMap.json**:
```json
{
  "newservice": [
    "newservice:Action1",
    "newservice:Action2"
  ]
}
```

2. **Update buildPolicy.js**:
```javascript
case "newservice":
  resources.push(`arn:aws:newservice:${region}:${accountId}:resource/${serviceName}-${stage}-*`);
  break;
```

3. **Add detection logic**:
```javascript
// In detectServicesFromConfig function
if (resource.Type.startsWith("AWS::NewService::")) {
  detectedServices.add("newservice");
}
```

### Extending Authorization Rules

Add new rules to `deployment.rego`:
```rego
# Example: Branch-based authorization
allow if {
    input.userRole == "developer"
    input.environment == "dev"
    startswith(input.branch, "feature/")
}
```

### Testing Changes

1. **Local testing**:
```bash
# Test policy generation
node scripts/buildPolicy.js ./test-serverless.yml

# Test context detection
ENVIRONMENT=dev node scripts/detectContext.js

# Test OPA policies
opa eval --data ./rules/deployment.rego --input ./test-context.json "data.deployment.allow"
```

2. **Pipeline testing**:
- Use development branch for testing
- Test with different user roles
- Verify policy generation for various configurations

---

## License
This project is licensed under the MIT License.

## Support
For questions and support, please create an issue in the project repository.