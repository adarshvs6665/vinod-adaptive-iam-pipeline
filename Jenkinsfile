pipeline {
    agent any

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'production'],
            description: 'Select the deployment environment'
        )
    }

    tools {
        nodejs 'nodejs'
    }

    environment {
        ENVIRONMENT = "${params.ENVIRONMENT}"
        HOME_BIN = "${env.HOME}/bin"
        PATH = "${env.HOME}/bin:${env.PATH}"
    }

    stages {
        stage('Pull main') {
            steps {
                git branch: 'main', url: 'https://github.com/adarshvs6665/vinod-adaptive-iam-pipeline.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    // Install npm dependencies in root folder
                    sh 'npm install'

                    // Go inside lambda-app folder and install npm dependencies
                    dir('lambda-app') {
                        sh 'npm install'
                    }

                    // Install serverless v3 globally
                    sh 'npm install -g serverless@3'

                    // Check if OPA is already installed in ~/bin, if not download it
                    sh '''
                        mkdir -p $HOME/bin
                        if ! [ -x "$HOME/bin/opa" ]; then
                            echo "Downloading OPA to $HOME/bin"
                            curl -L -o $HOME/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64
                            chmod +x $HOME/bin/opa
                        else
                            echo "OPA already exists in $HOME/bin"
                        fi

                        opa version
                        serverless --version
                    '''
                }
            }
        }

        stage('Extract context') {
            steps {
                script {
                    sh 'npm run detectContext'
                }
            }
        }

        stage('Evaluate context') {
            steps {
                script {
                    echo 'Evaluating deployment context with OPA policy'

                    def opaResult = sh(
                        script: 'opa eval --data ./rules/deployment.rego --input ./output/detected-context.json --format raw "data.deployment.allow"',
                        returnStdout: true
                    ).trim()

                    echo "OPA evaluation result: ${opaResult}"

                    if (opaResult != 'true') {
                        error("Deployment not authorized: Context evaluation failed. You don't have permission to deploy to the ${env.ENVIRONMENT} environment with the current context.")
                    }

                    echo "Context evaluation passed. Deployment authorized for ${env.ENVIRONMENT} environment."
                }
            }
        }

        stage('Generate dynamic policy') {
            steps {
                script {
                    sh 'npm run buildPolicy'
                }
            }
        }

        stage('Generate dynamic permissions') {
            steps {
                script {
                    echo "Getting temporary credentials via AssumeRole"
                    echo "Assuming role with dynamic policy"

                    // Set AWS region
                    env.AWS_REGION = 'us-east-1'
                    env.AWS_DEFAULT_REGION = env.AWS_REGION

                    // Role ARN to assume
                    def ROLE_ARN = "arn:aws:iam::784896966975:role/ServerlessDeploymentRole"

                    // Use Jenkins AWS credentials
                    withCredentials([aws(credentialsId: 'aws-credentials', region: env.AWS_REGION)]) {
                        sh """
                            aws sts assume-role \\
                                --region "${env.AWS_REGION}" \\
                                --role-arn "${ROLE_ARN}" \\
                                --role-session-name "deployment-session-${env.ENVIRONMENT}" \\
                                --policy file://output/generated-policy.json \\
                                --duration-seconds 900 > output/assume-role-credentials.json
                        """
                    }

                    echo "Assume role successful"

                    sh '''
                        # Extracting credentials
                        ACCESS_KEY=$(jq -r '.Credentials.AccessKeyId' output/assume-role-credentials.json)
                        SECRET_KEY=$(jq -r '.Credentials.SecretAccessKey' output/assume-role-credentials.json)
                        SESSION_TOKEN=$(jq -r '.Credentials.SessionToken' output/assume-role-credentials.json)
                        EXPIRATION=$(jq -r '.Credentials.Expiration' output/assume-role-credentials.json)

                        if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" || -z "$SESSION_TOKEN" ]]; then
                            echo "Error: Failed to extract temporary credentials from assume-role-credentials.json"
                            exit 1
                        fi

                        echo "Token expires at: $EXPIRATION"

                        echo "Configuring temporary AWS profile"
                        aws configure set aws_access_key_id "$ACCESS_KEY" --profile "tmp-profile"
                        aws configure set aws_secret_access_key "$SECRET_KEY" --profile "tmp-profile"
                        aws configure set aws_session_token "$SESSION_TOKEN" --profile "tmp-profile"
                        aws configure set region "$AWS_REGION" --profile "tmp-profile"

                        echo "Temporary profile 'tmp-profile' configured successfully"

                        echo "Verifying credentials"
                        aws sts get-caller-identity --profile "tmp-profile" --region "$AWS_REGION"
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    echo "Deploying to ${env.ENVIRONMENT}"

                    sh """
                        export AWS_PROFILE="tmp-profile"
                        serverless deploy --stage "${env.ENVIRONMENT}"
                    """

                    echo 'Deployment completed successfully!'
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline completed for environment: ${env.ENVIRONMENT}"
        }
        success {
            echo 'Pipeline succeeded'
        }
        failure {
            echo 'Pipeline failed'
        }
    }
}
