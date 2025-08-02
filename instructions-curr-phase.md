Week 1
------

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

Week 2
------
Added 'Jenkinsfile'. The jenkins file contain configuration for the pipeline. It will be updated during actual jenkins integration.

Remove comments.



Week 3
------
created the file detect-context.js which is a script that needs to be run during the deployment stage. Using the script we can understand the deployment context. It has info about user role, stage and env. Based on those OPA determines whether to allow or deny the deployment



aws sts get-federation-token   --name "my-session"   --policy file://output/generated-policy.json   --duration-seconds 900   --profile vinod