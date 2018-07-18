pipeline {
  agent {
    node {
      label 'pai'
    }

  }
  stages {
    stage('Build Images') {
      agent {
        node {
          label 'build-images'
        }

      }
      steps {
        sh '''#! /bin/bash

set -x

echo "Build finished!"
'''
      }
    }
    stage('Deploy') {
      parallel {
        stage('Install A SingleBox') {
          agent {
            node {
              label 'single-box'
            }

          }
          steps {
            sh '''#!/bin/bash
set -x

echo "Deploy SingleBox finished!"
'''
          }
        }
        stage('Install Cluster') {
          agent {
            node {
              label 'cluster-install'
            }

          }
          steps {
            sh '''#!/bin/bash
set -x

echo "Deploy Cluster finished!"
'''
          }
        }
      }
    }
    stage('Test') {
      parallel {
        stage('Test A SingleBox') {
          steps {
            script {
              try {
                sh '''#! /bin/bash

set -x
exit 1
'''
              } catch (err) {
                echo "Failed: ${err}"
                currentBuild.result = 'FAILURE'
              }
            }
          }
        }
        stage('Test Cluster') {
          steps {
            script {
              try {
                sh '''#! /bin/bash

  set -x

  exit 0
  '''
              } catch (err) {
                echo "Failed: ${err}"
                currentBuild.result = 'FAILURE'
              }
            }
          }
        }

        stage('Clean Up') {
          steps {
            when {
                // pause if failed, so we can reserve the environment for debuging
                expression { currentBuild.result == 'FAILURE' }
            }
            steps {
                input 'Failed! Would you like to clean the deployment now?'
            }
          }
        }
      }
    }
  }
  options {
    disableConcurrentBuilds()
  }
}