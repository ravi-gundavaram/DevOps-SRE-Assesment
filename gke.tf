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
