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
  }
  options {
    disableConcurrentBuilds()
  }
}