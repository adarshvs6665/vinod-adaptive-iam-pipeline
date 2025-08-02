package deployment

default allow := false

# Admin can deploy to dev or prod
allow if {
    input.userRole == "admin"
    input.environment == "dev"
}

allow if {
    input.userRole == "admin"
    input.environment == "prod"
}

# DevOps can deploy to dev or prod
allow if {
    input.userRole == "devops"
    input.environment == "dev"
}

allow if {
    input.userRole == "devops"
    input.environment == "prod"
}

# QA can only deploy to dev
allow if {
    input.userRole == "qa"
    input.environment == "dev"
}