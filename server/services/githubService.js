/**
 * githubService.js
 *
 * Handles GitHub version control operations: Push with commit, Pull/Update framework version,
 * branches/tags listing, and repository configuration using Git CLI and GitHub REST API.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.cwd(), 'data', 'github-config.json');

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[githubService] Error reading config:', err.message);
  }
  return {
    repoUrl: '',
    branch: 'main',
    token: '',
    authorName: 'Visa Automation User',
    authorEmail: 'dm443790@gmail.com'
  };
}

function saveConfig(newConfig) {
  const current = getConfig();
  const updated = { ...current, ...newConfig };
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

function runGit(command) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      resolve(stdout ? stdout.trim() : '');
    });
  });
}

async function ensureGitRepo() {
  const gitDir = path.join(process.cwd(), '.git');
  if (!fs.existsSync(gitDir)) {
    try {
      await runGit('git init -b main');
    } catch (e) {
      try {
        await runGit('git init');
        await runGit('git branch -M main');
      } catch (err2) {
        // ignore
      }
    }
  }
  const config = getConfig();
  if (config.authorName && config.authorEmail) {
    try {
      await runGit(`git config user.name "${config.authorName}"`);
      await runGit(`git config user.email "${config.authorEmail}"`);
    } catch (e) {
      // ignore
    }
  }
}

async function getStatus() {
  const config = getConfig();
  try {
    await ensureGitRepo();
    let statusOutput = await runGit('git status --porcelain');
    let currentBranch = '';
    try {
      currentBranch = await runGit('git branch --show-current');
    } catch (e) {
      currentBranch = config.branch || 'main';
    }
    if (!currentBranch) currentBranch = config.branch || 'main';
    
    let commitLog = [];
    try {
      const logStr = await runGit('git log -n 10 --format="%h|%an|%ar|%s"');
      if (logStr) {
        commitLog = logStr.split('\n').map(line => {
          const [hash, author, time, message] = line.split('|');
          return { hash, author, time, message };
        });
      }
    } catch (e) {
      // Ignore if no commits yet
    }

    const modifiedFiles = statusOutput ? statusOutput.split('\n').filter(Boolean) : [];

    return {
      success: true,
      configured: !!config.repoUrl,
      currentBranch,
      repoUrl: config.repoUrl,
      modifiedCount: modifiedFiles.length,
      modifiedFiles,
      commitLog
    };
  } catch (err) {
    return {
      success: false,
      configured: !!config.repoUrl,
      currentBranch: config.branch || 'main',
      repoUrl: config.repoUrl,
      modifiedCount: 0,
      modifiedFiles: [],
      commitLog: [],
      error: err.message
    };
  }
}

async function configureRemote() {
  const config = getConfig();
  if (!config.repoUrl) {
    throw new Error('Repository URL not configured.');
  }

  let remoteUrl = config.repoUrl;
  if (config.token) {
    // Inject token into https URL: https://TOKEN@github.com/owner/repo.git
    if (remoteUrl.startsWith('https://')) {
      const cleanUrl = remoteUrl.replace(/^https:\/\/[^@]+@/, 'https://');
      remoteUrl = cleanUrl.replace('https://', `https://${config.token}@`);
    }
  }

  try {
    await runGit('git remote remove origin');
  } catch (e) {
    // Ignore if origin didn't exist
  }

  await runGit(`git remote add origin "${remoteUrl}"`);
  if (config.authorName && config.authorEmail) {
    await runGit(`git config user.name "${config.authorName}"`);
    await runGit(`git config user.email "${config.authorEmail}"`);
  }
}

async function pushChanges(commitMessage) {
  if (!commitMessage || !commitMessage.trim()) {
    throw new Error('Commit message is required.');
  }
  const config = getConfig();
  await configureRemote();

  // Stage changes
  await runGit('git add -A');

  // Check if anything to commit
  const status = await runGit('git status --porcelain');
  if (status) {
    const escapedMsg = commitMessage.replace(/"/g, '\\"');
    await runGit(`git commit -m "${escapedMsg}"`);
  }

  const branch = config.branch || 'main';
  await runGit(`git push origin ${branch}`);

  return { success: true, message: 'Successfully pushed changes to GitHub!' };
}

async function parseGitHubRepoOwnerAndName(repoUrl) {
  // matches https://github.com/owner/repo.git or git@github.com:owner/repo.git
  const match = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(\.git)?$/i);
  if (!match) {
    throw new Error('Invalid GitHub repository URL format.');
  }
  return { owner: match[1], repo: match[2] };
}

async function getRemoteVersions() {
  const config = getConfig();
  if (!config.repoUrl) {
    throw new Error('Repository URL not configured.');
  }

  const { owner, repo } = await parseGitHubRepoOwnerAndName(config.repoUrl);
  const headers = {
    'User-Agent': 'Visa-Automation-Framework',
    'Accept': 'application/vnd.github.v3+json'
  };
  if (config.token) {
    headers['Authorization'] = `token ${config.token}`;
  }

  // Fetch branches
  const branchesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers });
  if (!branchesRes.ok) {
    const errText = await branchesRes.text();
    throw new Error(`Failed to fetch branches from GitHub API: ${errText}`);
  }
  const branchesData = await branchesRes.json();
  const branches = branchesData.map(b => ({ name: b.name, type: 'branch' }));

  // Fetch tags
  const tagsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`, { headers });
  let tags = [];
  if (tagsRes.ok) {
    const tagsData = await tagsRes.json();
    tags = tagsData.map(t => ({ name: t.name, type: 'tag' }));
  }

  return {
    success: true,
    versions: [...branches, ...tags]
  };
}

async function pullVersion(versionName) {
  if (!versionName) {
    throw new Error('Version name (branch or tag) is required.');
  }
  const config = getConfig();
  await configureRemote();

  // Fetch all remote branches and tags
  await runGit('git fetch origin --prune');

  // Checkout and pull/reset to version
  try {
    await runGit(`git checkout ${versionName}`);
  } catch (e) {
    // If local branch doesn't exist, checkout tracking remote
    await runGit(`git checkout -b ${versionName} origin/${versionName}`);
  }

  await runGit(`git pull origin ${versionName}`);

  return { success: true, message: `Successfully updated framework to version '${versionName}'!` };
}

module.exports = {
  getConfig,
  saveConfig,
  getStatus,
  pushChanges,
  getRemoteVersions,
  pullVersion
};
