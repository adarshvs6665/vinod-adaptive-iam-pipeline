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
