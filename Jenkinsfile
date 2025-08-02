pipeline {
    agent any
    
    parameters {
        choice(
            name: 'DEPLOYMENT_ENVIRONMENT',
            choices: ['dev', 'production'],
            description: 'Select the deployment environment'
        )
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
                        # Download and install OPA
                        curl -L -o opa https://openpolicyagent.org/downloads/v0.57.0/opa_linux_amd64_static
                        chmod 755 ./opa
                        sudo mv opa /usr/local/bin/
                        
                        # Verify OPA installation
                        opa version
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