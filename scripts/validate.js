#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Load configuration files
 */
function loadConfig() {
  const configDir = path.join(process.cwd(), 'config');
  
  const config = {
    reserved: [],
    trusted: []
  };
  
  // Load reserved subdomains
  const reservedPath = path.join(configDir, 'reserved.json');
  if (fs.existsSync(reservedPath)) {
    config.reserved = JSON.parse(fs.readFileSync(reservedPath, 'utf8'));
  }
  
  // Load trusted users (can have multiple domains)
  const trustedPath = path.join(configDir, 'trusted.json');
  if (fs.existsSync(trustedPath)) {
    config.trusted = JSON.parse(fs.readFileSync(trustedPath, 'utf8'));
  }
  
  return config;
}

/**
 * Validates if a string is a valid subdomain name (filename)
 */
function isValidSubdomain(subdomain) {
  // Must be lowercase, alphanumeric, and may include hyphens
  const subdomainRegex = /^[a-z0-9-]+$/;
  
  if (!subdomainRegex.test(subdomain)) {
    return { valid: false, reason: 'must be lowercase, alphanumeric, and may include hyphens only' };
  }
  
  // Cannot start or end with hyphen
  if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
    return { valid: false, reason: 'cannot start or end with hyphen' };
  }
  
  // Cannot contain consecutive hyphens
  if (subdomain.includes('--')) {
    return { valid: false, reason: 'cannot contain consecutive hyphens' };
  }
  
  // Must be between 1 and 63 characters (DNS limit)
  if (subdomain.length < 1 || subdomain.length > 63) {
    return { valid: false, reason: 'must be between 1 and 63 characters' };
  }
  
  return { valid: true };
}

/**
 * Validates if a string is a valid GitHub username
 */
function isValidGitHubUsername(username) {
  // GitHub username rules: alphanumeric and hyphens, cannot start with hyphen, max 39 chars
  const githubUsernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
  
  if (!githubUsernameRegex.test(username)) {
    return { valid: false, reason: 'must be a valid GitHub username (alphanumeric and hyphens, cannot start with hyphen, max 39 chars)' };
  }
  
  return { valid: true };
}

/**
 * Validates if a string is a valid email address
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validates if a string is a valid domain name for CNAME
 */
function isValidDomain(domain) {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!domainRegex.test(domain)) {
    return false;
  }
  
  if (!domain.includes('.')) {
    return false;
  }
  
  if (domain.length > 253) {
    return false;
  }
  
  return true;
}

/**
 * Check domain ownership limits (by GitHub username, not filename)
 */
function checkDomainLimits(files, config) {
  const userDomainCount = {};
  const violations = [];
  
  files.forEach(file => {
    const username = file.data?.owner?.username;
    if (!username) return;
    
    userDomainCount[username] = (userDomainCount[username] || 0) + 1;
  });
  
  Object.entries(userDomainCount).forEach(([username, count]) => {
    const isTrusted = config.trusted.includes(username);
    
    if (!isTrusted && count > 1) {
      violations.push({
        username,
        count,
        reason: `GitHub user "${username}" has ${count} domains but is not in trusted list (limit: 1)`
      });
    }
  });
  
  return violations;
}

/**
 * Check for duplicate subdomain names (filenames)
 */
function checkForDuplicateSubdomains(files) {
  const subdomains = {};
  const duplicates = [];
  
  files.forEach(file => {
    const subdomain = file.subdomain;
    if (!subdomain) return;
    
    if (subdomains[subdomain]) {
      duplicates.push({
        subdomain: subdomain,
        files: [subdomains[subdomain
