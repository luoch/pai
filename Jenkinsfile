pipeline {
  environment {
      CI_CLUSTER = "Unknown"
    }
  agent {
    node {
      label 'pai'
    }
  }
  stages {
    stage('Choose a CI Cluster') {
      steps {
        script {
          env.CI_CLUSTER = sh 'echo $NODE_NAME'
        }
        echo 'Select CI Cluster: $CI_CLUSTER'
      }
    }
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

#TODO
printenv

set -x
exit -1
'''
              } catch (err) {
                echo "Failed: ${err}"
                currentBuild.result = 'FAILURE'

                input 'Test SingleBox failed! Would you like to clean the deployment now?'
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

                input 'Test Cluster failed! Would you like to clean the deployment now?'
              }
            }
          }
        }
      }
    }
    stage('Clean Up') {
      parallel {
        stage('Clean up A SingleBox') {
          agent {
            node {
              label 'single-box'
            }

          }
          steps {
            sh '''#!/bin/bash
set -x

echo "Clean up!"
'''
          }
        }
        stage('Clean up Cluster') {
          agent {
            node {
              label 'cluster-install'
            }

          }
          steps {
            sh '''#!/bin/bash
set -x

echo "Clean up!"
'''
          }
        }
      }
    }
  }
  options {
    disableConcurrentBuilds()
  }
}