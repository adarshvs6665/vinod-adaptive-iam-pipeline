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
        
        stage('Build DetectContext') {
            steps {
                script {
                    sh 'npm run detectContext'
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