const { execSync } = require("child_process");

const runCommand = (command, fallback = "") => {
  try {
    return execSync(command).toString().replace(/'/g, "").trim();
  } catch {
    return fallback;
  }
};

const getCurrentBranch = () => {
  return runCommand("git rev-parse --abbrev-ref HEAD", "unknown");
};

const getLastCommitterEmail = () => {
  return runCommand("git log -1 --pretty=format:'%ce'", "unknown@gmail.com");
};

const getUserRole = (email) => {
  const roleMap = {
    "devops@gmail.com": "devops",
    "qa@gmail.com": "qa",
    "admin@gmail.com": "admin",
  };

  return roleMap[email] || "none";
};

const getTargetEnvironment = () => {
  return (process.env.ENVIRONMENT || "dev").toLowerCase();
};

const getDeploymentContext = () => {
  const branch = getCurrentBranch();
  const committerEmail = getLastCommitterEmail();
  const userRole = getUserRole(committerEmail);
  const environment = getTargetEnvironment();

  return {
    userEmail: committerEmail,
    userRole,
    branch,
    environment,
  };
};

const detectContext = () => {
  const context = getDeploymentContext();
  console.log(JSON.stringify(context, null, 2));
};

detectContext();
