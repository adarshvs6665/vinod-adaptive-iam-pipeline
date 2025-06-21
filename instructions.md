1. Understand the Core Problem
The challenge:
 Static IAM (RBAC) is too rigid for serverless + CI/CD environments, leading to:
Excessive permissions


Privilege escalations


Misuse of long-lived secrets


You aim to dynamically generate least-privilege, attribute-aware policies tied to:
CI/CD pipeline stage (build, test, deploy)


Runtime attributes (e.g., who/what invoked the function, from where, etc.)


🔹 Step 1: Define the Problem Clearly
Understand limitations of traditional IAM (e.g., static, over-permissioned, not agile).


Focus on serverless CI/CD environments where IAM must adapt quickly and securely.



🔹 Step 2: Conduct a Literature Review
Study current IAM systems (RBAC, ABAC, PBAC) and their shortcomings.


Analyze how existing CI/CD tools (GitHub Actions, Jenkins, etc.) handle permissions.


Review recent security breaches or case studies involving IAM misconfigurations in DevOps.


