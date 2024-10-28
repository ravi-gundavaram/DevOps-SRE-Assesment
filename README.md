# DevOps-SRE-Assesment
DevOps-SRE-Assesment

Task 1: Set Up the GCP Project
1.1 Create a New GCP Project

gcloud projects create <PROJECT_ID> --name="DevOps-SRE-Assessment" --set-as-default
gcloud config set project <PROJECT_ID>

1.2 Enable Required APIs

gcloud services enable compute.googleapis.com \
    container.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com

1.3 Configure IAM
Create service accounts for Terraform, GKE, and CI/CD pipelines.

gcloud iam service-accounts create terraform --display-name="Terraform Service Account"
gcloud iam service-accounts create gke-sa --display-name="GKE Service Account"
gcloud iam service-accounts create cicd --display-name="CI/CD Service Account"

Task 2: Configure VPC Networking
2.1 Create a Custom VPC using Terraform
vpc.tf

resource "google_compute_network" "vpc_network" {
  name = "devops-sre-vpc"
}

resource "google_compute_subnetwork" "subnet" {
  name          = "devops-sre-subnet"
  ip_cidr_range = "10.0.0.0/16"
  region        = "us-central1"
  network       = google_compute_network.vpc_network.id
}

resource "google_compute_firewall" "allow_internal" {
  name    = "allow-internal"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["10.0.0.0/16"]
}

2.2 Initialize and Apply Terraform

terraform init
terraform apply

Task 3: Deploy Kubernetes Clusters on GKE
3.1 GKE Cluster Configuration (with Terraform)
gke.tf

resource "google_container_cluster" "gke_cluster" {
  name     = "devops-sre-gke-cluster"
  location = "us-central1-a"
  network  = google_compute_network.vpc_network.id

  node_config {
    machine_type = "e2-standard-4"
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
  }
}

3.2 Run Terraform
terraform apply -target=google_container_cluster.gke_cluster

Task 4: Deploy and Configure HashiCorp Vault
4.1 Deploy Vault using Helm in Kubernetes
Add Helm repository and install Vault:
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault --namespace vault --create-namespace

4.2 Configure Kubernetes Authentication
Set up Kubernetes authentication within Vault:
kubectl exec -it vault-0 -- vault auth enable kubernetes
kubectl exec -it vault-0 -- vault write auth/kubernetes/config \
    token_reviewer_jwt="$(kubectl get secret vault-token -o go-template='{{ .data.token }}' | base64 --decode)" \
    kubernetes_host="https://<KUBERNETES_API_SERVER>"

Task 5: Set Up CI/CD Pipeline with GitOps
5.1 Configure Git Repository for CI/CD
Initialize a Git repository and add your Kubernetes manifests and Terraform files.
5.2 GitLab/GitHub Actions for CI/CD Pipeline (Example GitHub Action)
Configure a pipeline to build and deploy Docker images:
.github/workflows/deploy.yml

name: CI/CD Pipeline

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v2

      - name: Set up Google Cloud SDK
        uses: google-github-actions/setup-gcloud@v0

      - name: Build Docker Image
        run: docker build -t gcr.io/$PROJECT_ID/my-app .

      - name: Push to Artifact Registry
        run: docker push gcr.io/$PROJECT_ID/my-app

Task 6: Monitoring and Logging with Prometheus and Grafana
6.1 Deploy Prometheus and Grafana Using Helm

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus --namespace monitoring --create-namespace
helm install grafana grafana/grafana --namespace monitoring

Task 7: Deploy Application with Load Balancer and Security
7.1 Configure Kubernetes Service with Load Balancer
Example of a LoadBalancer service:
service.yaml

apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app: my-app

1. Ingress Configuration with HTTPS Using cert-manager
To secure the application with HTTPS, install cert-manager and create an Ingress resource for your application.

1.1 Install cert-manager

kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.5.4/cert-manager.yaml

1.2 Create an Ingress Resource with TLS
Assuming you’re using a domain like example.com, configure an ingress resource for HTTPS.
ingress.yaml

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  namespace: default
  annotations:
    cert-manager.io/issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - example.com
      secretName: my-app-tls
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app-service
                port:
                  number: 80

1.3 Create a ClusterIssuer for Let’s Encrypt
letsencrypt-issuer.yaml

apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
Apply the issuer:
kubectl apply -f letsencrypt-issuer.yaml

2. Detailed Network Policies
Configure network policies to restrict pod communication within namespaces or by labels. Here’s an example of a restrictive policy that only allows ingress traffic from specific pods.

network-policy.yaml

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restrict-traffic
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: my-app
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              role: frontend
      ports:
        - protocol: TCP
          port: 8080

3. CI/CD Pipeline Enhancements (GitHub Actions)
To add testing and security scanning stages, update the pipeline file.

.github/workflows/deploy.yml

name: CI/CD Pipeline

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v2

      - name: Set up Google Cloud SDK
        uses: google-github-actions/setup-gcloud@v0

      - name: Build Docker Image
        run: docker build -t gcr.io/$PROJECT_ID/my-app .

      - name: Run Tests
        run: |
          docker run --rm gcr.io/$PROJECT_ID/my-app pytest tests/
      
      - name: Security Scan
        uses: aquasecurity/trivy-action@v0.0.5
        with:
          image-ref: gcr.io/$PROJECT_ID/my-app

      - name: Push to Artifact Registry
        run: docker push gcr.io/$PROJECT_ID/my-app

      - name: Deploy to GKE
        run: |
          kubectl apply -f k8s/deployment.yaml
          kubectl apply -f k8s/service.yaml

4. GitOps Refinements in ArgoCD
Add health checks and sync waves for staged deployments in ArgoCD.

4.1 Health Checks in Application Manifest
Define ArgoCD health checks in the Kubernetes manifests to ensure readiness.

deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: gcr.io/$PROJECT_ID/my-app
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20

5. Load Testing and Monitoring Validation
Use tools like k6 for load testing and validate monitoring and alerting configurations.

5.1 Load Test Script with k6
Install k6 and create a test script to check application performance.

load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 }, // ramp-up to 100 users
    { duration: '5m', target: 100 },
    { duration: '1m', target: 0 },   // ramp-down
  ],
};

export default function () {
  let res = http.get('http://example.com/');
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(1);
}
Run the test:
k6 run load-test.js


5.2 Monitoring Validation in Prometheus and Grafana
After the load test, check Grafana dashboards for metrics related to response time, CPU, and memory usage.
Validate alert rules in Prometheus by temporarily increasing thresholds and observing alert triggers.

6. Documentation & User Guide
Created a README.md file in my repository with all configurations and deployment instructions:

# DevOps/SRE Assessment Guide

## Project Overview
This project demonstrates a scalable, secure GCP and Kubernetes architecture using CI/CD, GitOps, HashiCorp Vault for secrets management, monitoring, and IaC practices.

## Prerequisites
- GCP Project ID
- Docker and kubectl installed locally

## Steps
1. **Infrastructure Setup**:
   - Run `terraform apply` to create the VPC and GKE clusters.

2. **CI/CD Configuration**:
   - Use GitHub Actions for automated deployment. Modify `.github/workflows/deploy.yml` with your PROJECT_ID.

3. **GitOps and Vault Integration**:
   - Deploy ArgoCD and connect to Vault for secret injection.

4. **Monitoring and Load Testing**:
   - Prometheus and Grafana are configured for monitoring.
   - Use `k6` for load testing.

## Accessing the Application
- Access via `http://<LOAD_BALANCER_IP>` or configured Ingress domain.

