package access

default allow = false

allow {
  input.user.role == "devops"
  input.pipeline.stage == "deploy"
  input.resource.environment == "dev"
}
