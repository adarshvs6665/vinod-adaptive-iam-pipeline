pipeline {
  agent any

  environment {
    USER_ROLE = "default"
    PIPELINE_STAGE = "default"
    ENVIRONMENT = "default"
    AWS_REGION = 'eu-west-1'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        sh '''
          npm install
        '''
      }
    }

    stage('Detect Context') {
      steps {
        script {
          def output = sh(script: 'node scripts/detect-context.js', returnStdout: true).trim()
          def parsed = readJSON text: output

          env.USER_ROLE = parsed.userRole
          env.PIPELINE_STAGE = parsed.pipelineStage
          env.ENVIRONMENT = parsed.environment
          
          echo "Context detected:"
          echo "  USER_ROLE: ${env.USER_ROLE}"
          echo "  PIPELINE_STAGE: ${env.PIPELINE_STAGE}"
          echo "  ENVIRONMENT: ${env.ENVIRONMENT}"
        }
      }
    }

    stage('Start OPA (via Docker Compose)') {
      steps {
        sh '''
          docker-compose down || true
          docker-compose up -d
          sleep 3
        '''
      }
    }

    stage('Evaluate Access Policy') {
      steps {
        script {
          def result = sh(script: 'node scripts/evaluate-policy.js', returnStatus: true)
          if (result != 0) {
            error("Access denied by OPA. Stopping pipeline.")
          }
        }
      }
    }

    stage('Generate IAM Policy Dynamically') {
      steps {
        // Step to generate IAM policy based on evaluated OPA policy
      }
    }

    stage('Assume Role with STS') {
      steps {
        sh 'node scripts/assume-role.js'
      }
    }

    stage('Deploy to AWS') {
      steps {
        // Step to deploy to AWS
      }
    }
  }

  post {
    always {
      sh 'docker-compose down || true'
    }
  }
}
