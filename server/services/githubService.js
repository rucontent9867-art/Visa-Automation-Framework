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
  let cmd = command;
  if (cmd.startsWith('git ') && !cmd.includes('safe.directory')) {
    cmd = cmd.replace(/^git\s+/, 'git -c safe.directory=* ');
  }
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
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

    let updateInfo = null;
    if (config.repoUrl) {
      try {
        updateInfo = await checkForUpdates();
      } catch (e) {
        // ignore
      }
    }

    return {
      success: true,
      configured: !!config.repoUrl,
      currentBranch,
      repoUrl: config.repoUrl,
      modifiedCount: modifiedFiles.length,
      modifiedFiles,
      commitLog,
      updateInfo
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
  if (!remoteUrl.endsWith('.git')) {
    remoteUrl += '.git';
  }
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
    await runGit(`git config user.name "${config.authorName.replace(/"/g, '')}"`);
    await runGit(`git config user.email "${config.authorEmail.replace(/"/g, '')}"`);
  }
}

async function pushChanges(commitMessage, targetBranch) {
  if (!commitMessage || !commitMessage.trim()) {
    throw new Error('Commit message is required.');
  }
  const config = getConfig();
  await configureRemote();

  const finalBranch = (targetBranch && targetBranch.trim()) ? targetBranch.trim() : (config.branch || 'main');

  // If targetBranch is provided and differs from current branch, checkout -B targetBranch
  let currentBranch = '';
  try {
    currentBranch = await runGit('git branch --show-current');
  } catch (e) {
    currentBranch = config.branch || 'main';
  }

  if (targetBranch && targetBranch.trim() && targetBranch.trim() !== currentBranch) {
    await runGit(`git checkout -B ${finalBranch}`);
  }

  // Stage changes
  await runGit('git add -A');

  // Check if anything to commit
  const status = await runGit('git status --porcelain');
  if (status) {
    const escapedMsg = commitMessage.replace(/"/g, '\\"');
    await runGit(`git commit -m "${escapedMsg}"`);
  }

  try {
    await runGit(`git push -u origin ${finalBranch}`);
  } catch (pushErr) {
    // If push is rejected due to workflow scope, auto-untrack .github and retry
    if (pushErr.message && pushErr.message.includes("without 'workflow' scope")) {
      console.log('[githubService] Token lacks workflow scope. Automatically untracking .github/workflows and retrying push...');
      try {
        await runGit('git rm --cached -r .github/workflows 2>/dev/null || true');
        let gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
        if (!gitignore.includes('.github/')) {
          gitignore += '\n.github/\n';
          fs.writeFileSync('.gitignore', gitignore, 'utf8');
          await runGit('git add .gitignore');
        }
        await runGit('git commit --amend --no-edit || true');
        await runGit(`git push -u origin ${finalBranch}`);
        return {
          ok: true,
          success: true,
          branch: finalBranch,
          warning: 'workflow_excluded',
          message: `Successfully pushed changes to branch '${finalBranch}'! (Workflow files were excluded because the token lacks the 'workflow' scope).`
        };
      } catch (retryErr) {
        throw new Error(retryErr.message);
      }
    }
    throw pushErr;
  }

  return { ok: true, success: true, branch: finalBranch, message: `Successfully pushed changes to branch '${finalBranch}' on GitHub!` };
}

async function parseGitHubRepoOwnerAndName(repoUrl) {
  // matches https://github.com/owner/repo.git or git@github.com:owner/repo.git
  const match = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(\.git)?$/i);
  if (!match) {
    throw new Error('Invalid GitHub repository URL format.');
  }
  return { owner: match[1], repo: match[2] };
}

function buildAccessRequestUrl(owner, repo, username) {
  const user = username || 'user';
  const title = encodeURIComponent(`Request write access for ${user}`);
  const body = encodeURIComponent(
    `Hi, I need write access to contribute to this repository. Please add me as a collaborator. My GitHub username is ${user}.`
  );
  return `https://github.com/${owner}/${repo}/issues/new?title=${title}&body=${body}&labels=access-request`;
}

async function checkUserPermission() {
  const config = getConfig();
  if (!config.repoUrl) {
    throw new Error('Repository URL not configured.');
  }
  if (!config.token) {
    return {
      canPush: false,
      level: 'none',
      username: config.authorName || 'guest',
      hasToken: false,
      error: 'no_token',
      message: 'Personal Access Token required to check permissions.'
    };
  }
  const { owner, repo } = await parseGitHubRepoOwnerAndName(config.repoUrl);

  const headers = {
    'User-Agent': 'Visa-Automation-Framework',
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `token ${config.token}`
  };

  // 1. Fetch user info to get username
  let username = config.authorName || 'user';
  try {
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (userRes.status === 401 || userRes.status === 403) {
      const err = new Error('invalid_token');
      err.code = 'invalid_token';
      throw err;
    }
    if (userRes.ok) {
      const userData = await userRes.json();
      if (userData && userData.login) {
        username = userData.login;
      }
    }
  } catch (e) {
    if (e.code === 'invalid_token') throw e;
    if (e.name === 'FetchError' || e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
      const netErr = new Error('network');
      netErr.code = 'network';
      throw netErr;
    }
  }

  // 2. Fetch repo details to check permissions
  let repoRes;
  try {
    repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  } catch (e) {
    const netErr = new Error('network');
    netErr.code = 'network';
    throw netErr;
  }

  if (repoRes.status === 401 || repoRes.status === 403) {
    const err = new Error('invalid_token');
    err.code = 'invalid_token';
    throw err;
  }

  if (!repoRes.ok) {
    const errText = await repoRes.text();
    throw new Error(`GitHub repo query failed (${repoRes.status}): ${errText}`);
  }

  const repoData = await repoRes.json();
  const permissions = repoData.permissions || {};
  const canPush = Boolean(permissions.push || permissions.admin || permissions.maintain);

  let level = 'none';
  if (permissions.admin) {
    level = 'admin';
  } else if (permissions.maintain) {
    level = 'maintain';
  } else if (permissions.push) {
    level = 'push';
  } else if (permissions.pull) {
    level = 'pull';
  }

  return {
    canPush,
    level,
    username,
    owner,
    repo,
    permissions
  };
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
  const targetRef = versionName || 'main';
  const config = getConfig();
  await configureRemote();

  // Check if targetRef is a tag
  let isTag = false;
  try {
    const { versions } = await getRemoteVersions();
    isTag = versions.some(v => v.type === 'tag' && v.name === targetRef);
  } catch (e) {
    // ignore
  }

  if (isTag) {
    await runGit('git fetch origin --tags --prune');
    await runGit(`git checkout ${targetRef}`);
    return {
      ok: true,
      success: true,
      detached: true,
      ref: targetRef,
      message: `Checked out tag '${targetRef}' in detached HEAD state.`
    };
  }

  // Otherwise, branch pull
  await runGit('git fetch origin --prune');
  try {
    await runGit(`git checkout ${targetRef}`);
  } catch (e) {
    await runGit(`git checkout -b ${targetRef} origin/${targetRef}`);
  }
  await runGit(`git pull origin ${targetRef}`);

  return { ok: true, success: true, detached: false, ref: targetRef, message: `Successfully updated framework to version '${targetRef}'!` };
}

async function getCommitDiff(sha) {
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

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, { headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API commit query failed: ${errText}`);
  }
  const data = await res.json();
  const rawFiles = data.files || [];
  const files = rawFiles.map(f => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ? f.patch.substring(0, 2000) : ''
  }));

  return {
    ok: true,
    sha: data.sha || sha,
    message: data.commit?.message || '',
    author: data.commit?.author?.name || data.author?.login || 'Unknown',
    date: data.commit?.author?.date || '',
    files
  };
}

async function rollbackToTag(tag) {
  if (!tag || !tag.trim()) {
    throw new Error('Tag name is required for rollback.');
  }
  const targetTag = tag.trim();
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

  // Validate tag exists via GitHub API
  const tagsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`, { headers });
  if (!tagsRes.ok) {
    throw new Error('Failed to verify tags with remote repository.');
  }
  const tags = await tagsRes.json();
  const exists = Array.isArray(tags) && tags.some(t => t.name === targetTag);
  if (!exists) {
    throw new Error(`Tag '${targetTag}' not found in remote repository.`);
  }

  await configureRemote();
  await runGit('git fetch origin --tags --prune');
  await runGit(`git checkout ${targetTag}`);

  return {
    ok: true,
    success: true,
    detached: true,
    tag: targetTag,
    message: `Working tree is now at ${targetTag}. To resume development, run: git checkout -b recover-${targetTag}`
  };
}

async function checkForUpdates() {
  const config = getConfig();
  if (!config.repoUrl) {
    return { hasUpdate: false, reason: 'Repository URL not configured' };
  }
  try {
    const { owner, repo } = await parseGitHubRepoOwnerAndName(config.repoUrl);
    const branch = config.branch || 'main';
    const headers = {
      'User-Agent': 'Visa-Automation-Framework',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (config.token) {
      headers['Authorization'] = `token ${config.token}`;
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${branch}`, { headers });
    if (!res.ok) {
      return { hasUpdate: false, error: `GitHub API status ${res.status}` };
    }
    const data = await res.json();
    const remoteSha = data.sha;

    let localSha = '';
    try {
      localSha = await runGit('git rev-parse HEAD');
    } catch (e) {
      localSha = '';
    }

    const hasUpdate = Boolean(remoteSha && localSha && remoteSha !== localSha);
    return {
      hasUpdate,
      remoteCommit: {
        sha: remoteSha ? remoteSha.substring(0, 7) : '',
        message: data.commit?.message?.split('\n')[0] || '',
        author: data.commit?.author?.name || '',
        date: data.commit?.author?.date || ''
      },
      localCommit: {
        sha: localSha ? localSha.substring(0, 7) : 'none'
      },
      branch
    };
  } catch (err) {
    return { hasUpdate: false, error: err.message };
  }
}

module.exports = {
  getConfig,
  saveConfig,
  getStatus,
  pushChanges,
  getRemoteVersions,
  pullVersion,
  checkForUpdates,
  checkUserPermission,
  buildAccessRequestUrl,
  getCommitDiff,
  rollbackToTag,
  parseGitHubRepoOwnerAndName
};
