We have created a sample application. its just the boiler plate. code will be updated. the application is inside lambda-app folder

This lambda-app will be deployed using the serverless.yml.

The deployment will be done in the CI/CD pipeline. which is not implemented yet.

We have to determine the required permissions by analysing the code. 

The above feature is not implemented now. Will do later.

Below is the architecture we are planning to implement : 
[CI/CD Trigger (e.g., GitHub Actions or Jenkin pipeline)]  
         ↓  
[Extract Context (user, stage, resource, etc.)]  
         ↓  
[Call OPA (policy engine via HTTP or local module)]  
         ↓  
[OPA Decision: allow/deny]  
         ↓  
Allow → [Use AWS STS to Assume Role with Scoped Policy]  
Deny  → [Log, Block Deployment/Access]  