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

                    // Install Serverless Framework v3 globally
                    sh 'npm install -g serverless@3'

                    // Check if OPA is already installed in ~/bin, if not download it
                    sh '''
                        mkdir -p $HOME/bin
                        if ! [ -x "$HOME/bin/opa" ]; then
                            echo "Downloading OPA to $HOME/bin..."
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

        stage('Detect deployment context') {
            steps {
                script {
                    sh 'npm run detectContext'
                }
            }
        }

        stage('Context evaluation') {
            steps {
                script {
                    echo "Evaluating deployment context with OPA policy..."

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

        stage('Get Federation Token') {
            steps {
                script {
                    withCredentials([aws(credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                        echo "Getting federation token with dynamic policy..."
                        
                        // Get federation token and save the output
                        def tokenOutput = sh(
                            script: '''
                                aws sts get-federation-token \
                                    --name "deployment-session" \
                                    --policy file://output/generated-policy.json \
                                    --duration-seconds 900
                            ''',
                            returnStdout: true
                        ).trim()
                        
                        echo "Federation token obtained successfully"
                        
                        // Save the token output to a file
                        writeFile file: 'output/federation-token.json', text: tokenOutput
                        
                        // Parse the JSON and extract credentials for environment variables
                        def tokenData = readJSON file: 'output/federation-token.json'
                        
                        // Write credentials to environment file for next stage
                        def credentialsEnv = """
AWS_ACCESS_KEY_ID=${tokenData.Credentials.AccessKeyId}
AWS_SECRET_ACCESS_KEY=${tokenData.Credentials.SecretAccessKey}
AWS_SESSION_TOKEN=${tokenData.Credentials.SessionToken}
AWS_TOKEN_EXPIRATION=${tokenData.Credentials.Expiration}
                        """.trim()
                        
                        writeFile file: 'output/deployment-credentials.env', text: credentialsEnv
                        
                        echo "Federation token and credentials saved to output/ folder"
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    def deploymentSuccessful = false
                    
                    // First, try deploying with federation token if available
                    if (fileExists('output/deployment-credentials.env')) {
                        try {
                            echo "Attempting deployment with federation token..."
                            
                            // Read the credentials from the environment file
                            def credentialsProps = readProperties file: 'output/deployment-credentials.env'
                            
                            // Set the temporary AWS credentials as environment variables
                            withEnv([
                                "AWS_ACCESS_KEY_ID=${credentialsProps.AWS_ACCESS_KEY_ID}",
                                "AWS_SECRET_ACCESS_KEY=${credentialsProps.AWS_SECRET_ACCESS_KEY}",
                                "AWS_SESSION_TOKEN=${credentialsProps.AWS_SESSION_TOKEN}"
                            ]) {
                                echo "Deploying to ${env.ENVIRONMENT} environment using federation token..."
                                echo "Token expires at: ${credentialsProps.AWS_TOKEN_EXPIRATION}"
                                
                                // Verify the credentials work
                                sh 'aws sts get-caller-identity'
                                
                                // Run serverless deploy
                                sh "serverless deploy --stage ${env.ENVIRONMENT}"
                                
                                deploymentSuccessful = true
                                echo "Deployment completed successfully with federation token!"
                            }
                        } catch (Exception e) {
                            echo "Federation token deployment failed: ${e.getMessage()}"
                            echo "Will fallback to using base AWS credentials..."
                        }
                    } else {
                        echo "Federation token credentials not found, will use base AWS credentials..."
                    }
                    
                    // Fallback to base AWS credentials if federation token failed or doesn't exist
                    if (!deploymentSuccessful) {
                        echo "Attempting deployment with base AWS credentials..."
                        
                        withCredentials([aws(credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                            echo "Deploying to ${env.ENVIRONMENT} environment using base AWS credentials..."
                            
                            // Verify the credentials work
                            sh 'aws sts get-caller-identity'
                            
                            // Run serverless deploy
                            sh "serverless deploy --stage ${env.ENVIRONMENT}"
                            
                            echo "Deployment completed successfully with base AWS credentials!"
                            echo "WARNING: Deployment used full AWS credentials instead of restricted federation token."
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline completed for environment: ${env.ENVIRONMENT}"
            
            // Clean up sensitive files
            script {
                sh '''
                    if [ -f "output/federation-token.json" ]; then
                        rm -f output/federation-token.json
                        echo "Cleaned up federation token file"
                    fi
                    if [ -f "output/deployment-credentials.env" ]; then
                        rm -f output/deployment-credentials.env
                        echo "Cleaned up credentials environment file"
                    fi
                '''
            }
        }
        success {
            echo "Pipeline succeeded"
        }
        failure {
            echo "Pipeline failed"
        }
    }
}
