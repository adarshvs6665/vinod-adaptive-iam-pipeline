pipeline {
    agent any
    
    parameters {
        choice(
            name: 'DEPLOYMENT_ENVIRONMENT',
            choices: ['dev', 'production'],
            description: 'Select the deployment environment'
        )
    }
    tools {
        nodejs 'nodejs'
    }
    environment {
        ENVIRONMENT = "${params.DEPLOYMENT_ENVIRONMENT}"
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
                        # Download OPA binary
                        curl -L -o ./opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64

                        # Make it executable
                        chmod +x ./opa

                        # Optionally add current dir to PATH
                        export PATH=$PATH:$(pwd)

                        # Verify
                        ./opa version
                    '''
                }
            }
        }
        
        stage('Build DetectContext') {
            steps {
                script {
                    // Run build:detectContext command from root
                    sh 'npm run build:detectContext'
                }
            }
        }
    }
    
    post {
        always {
            echo "Pipeline completed for environment: ${env.ENVIRONMENT}"
        }
        success {
            echo "Pipeline succeeded!"
        }
        failure {
            echo "Pipeline failed!"
        }
    }
}