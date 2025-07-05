const { execSync } = require("child_process");

function getBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

function getEmail() {
  try {
    return execSync("git log -1 --pretty=format:'%ae'")
      .toString()
      .replace(/'/g, "")
      .trim();
  } catch {
    return "unknown@gmail.com";
  }
}

function getRole(email) {
  const roleMap = {
    "devops@gmail.com": "devops",
    "qa@gmail.com": "qa",
    "admin@gmail.com": "admin",
  };

  return roleMap[email] || "none";
}

const branch = getBranch();
const userEmail = getEmail();
const userRole = getRole(userEmail);

let pipelineStage = "dev";

if (branch === "main") pipelineStage = "deploy";
else if (branch === "dev") pipelineStage = "test";

console.log(
  JSON.stringify({
    userRole,
    pipelineStage,
    environment: pipelineStage,
  })
);
