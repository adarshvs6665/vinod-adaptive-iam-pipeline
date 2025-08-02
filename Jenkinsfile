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
                    
                    // Install OPA (Open Policy Agent)
                    sh '''
                        # Clean up any existing opa dir or file conflict
                        rm -rf opa opa_binary
                        
                        # Download OPA binary
                        curl -L -o opa_binary https://openpolicyagent.org/downloads/latest/opa_linux_amd64
                        
                        # Make it executable
                        chmod +x opa_binary
                        
                        # Verify
                        ./opa_binary version
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
        
        stage('Context Evaluation') {
            steps {
                script {
                    echo "Evaluating deployment context with OPA policy..."
                    
                    // Run OPA evaluation and capture the result
                    def opaResult = sh(
                        script: './opa_binary eval --data ./opa/deployment.rego --input ./output/detected-context.json --format raw "data.deployment.allow"',
                        returnStdout: true
                    ).trim()
                    
                    echo "OPA evaluation result: ${opaResult}"
                    
                    // Check if the result is true
                    if (opaResult != 'true') {
                        error("Deployment not authorized: Context evaluation failed. You don't have permission to deploy to the ${env.ENVIRONMENT} environment with the current context.")
                    }
                    
                    echo "Context evaluation passed. Deployment authorized for ${env.ENVIRONMENT} environment."
                }
            }
        }
    }
    
    post {
        always {
            echo "Pipeline completed for environment: ${env.ENVIRONMENT}"
        }
        success {
            echo "Pipeline succeeded"
        }
        failure {
            echo "Pipeline failed"
        }
    }
}