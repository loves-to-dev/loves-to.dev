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
        files: [subdomains[subdomain], file.filePath]
      });
    } else {
      subdomains[subdomain] = file.filePath;
    }
  });
  
  return duplicates;
}

/**
 * Validates a single domain JSON file
 */
function validateDomainFile(filePath, subdomain, config, prAuthor = null) {
  const errors = [];
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let domainData;
    
    try {
      domainData = JSON.parse(fileContent);
    } catch (parseError) {
      return {
        success: false,
        errors: [`Invalid JSON format: ${parseError.message}`],
        data: null
      };
    }
    
    // Validate structure
    if (!domainData.owner || typeof domainData.owner !== 'object') {
      errors.push('Missing or invalid "owner" object');
    } else {
      // Validate GitHub username
      if (!domainData.owner.username || typeof domainData.owner.username !== 'string') {
        errors.push('Missing or invalid "owner.username" field');
      } else {
        const username = domainData.owner.username;
        
        // Validate GitHub username format
        const usernameValidation = isValidGitHubUsername(username);
        if (!usernameValidation.valid) {
          errors.push(`Invalid GitHub username "${username}": ${usernameValidation.reason}`);
        }
        
        // SECURITY CHECK: Verify username matches PR author
        if (prAuthor && username !== prAuthor) {
          errors.push(`Security violation: GitHub username "${username}" doesn't match PR author "${prAuthor}". You can only register domains for your own GitHub account.`);
        }
      }
      
      // Validate email
      if (!domainData.owner.email || typeof domainData.owner.email !== 'string') {
        errors.push('Missing or invalid "owner.email" field');
      } else if (!isValidEmail(domainData.owner.email)) {
        errors.push(`Invalid email address: ${domainData.owner.email}`);
      }
    }
    
    // Validate subdomain name (filename without .json)
    const subdomainValidation = isValidSubdomain(subdomain);
    if (!subdomainValidation.valid) {
      errors.push(`Invalid subdomain name "${subdomain}": ${subdomainValidation.reason}`);
    }
    
    // Check if subdomain is reserved
    if (config.reserved.includes(subdomain)) {
      errors.push(`Subdomain "${subdomain}" is reserved`);
    }
    
    // Validate records
    if (!domainData.records || typeof domainData.records !== 'object') {
      errors.push('Missing or invalid "records" object');
    } else {
      // Validate CNAME record (only supported record type)
      if (!domainData.records.CNAME || typeof domainData.records.CNAME !== 'string') {
        errors.push('Missing or invalid "records.CNAME" field');
      } else if (!isValidDomain(domainData.records.CNAME)) {
        errors.push(`Invalid CNAME domain: ${domainData.records.CNAME}`);
      }
      
      // Ensure only CNAME is used
      const allowedRecords = ['CNAME'];
      const providedRecords = Object.keys(domainData.records);
      const invalidRecords = providedRecords.filter(record => !allowedRecords.includes(record));
      
      if (invalidRecords.length > 0) {
        errors.push(`Only CNAME records are supported. Invalid records: ${invalidRecords.join(', ')}`);
      }
    }
    
    return {
      success: errors.length === 0,
      errors: errors,
      data: domainData
    };
    
  } catch (error) {
    return {
      success: false,
      errors: [`Error reading file: ${error.message}`],
      data: null
    };
  }
}

/**
 * Get all domain files
 */
function getAllDomainFiles() {
  const domainsDir = path.join(process.cwd(), 'domains');
  
  if (!fs.existsSync(domainsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(domainsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => ({
      filePath: path.join(domainsDir, file),
      filename: file,
      subdomain: file.replace('.json', ''),
      data: null
    }));
  
  return files;
}

/**
 * Main validation function
 */
function validateAllDomains() {
  console.log('🔍 Loading configuration...');
  const config = loadConfig();
  
  // Get PR author from environment (set by GitHub Actions)
  const prAuthor = process.env.GITHUB_ACTOR || process.env.PR_AUTHOR;
  
  console.log(`📋 Configuration loaded:`);
  console.log(`   Reserved subdomains: ${config.reserved.length}`);
  console.log(`   Trusted users: ${config.trusted.length}`);
  if (prAuthor) {
    console.log(`   PR Author: ${prAuthor}`);
  }
  console.log('');
  
  const files = getAllDomainFiles();
  
  if (files.length === 0) {
    console.log('✅ No domain files to validate');
    return;
  }
  
  console.log(`🔍 Validating ${files.length} domain file(s)...\n`);
  
  let hasErrors = false;
  let validCount = 0;
  
  // Validate each file and collect data
  files.forEach(file => {
    const result = validateDomainFile(file.filePath, file.subdomain, config, prAuthor);
    file.data = result.data;
    
    if (result.success) {
      console.log(`✅ ${file.filename}`);
      validCount++;
    } else {
      console.error(`❌ ${file.filename}`);
      result.errors.forEach(error => {
        console.error(`   ${error}`);
      });
      console.error('');
      hasErrors = true;
    }
  });
  
  // Check for duplicate subdomains
  const duplicates = checkForDuplicateSubdomains(files.filter(f => f.data));
  if (duplicates.length > 0) {
    console.error('❌ Duplicate subdomain names found:');
    duplicates.forEach(dup => {
      console.error(`   Subdomain "${dup.subdomain}" appears in multiple files:`);
      dup.files.forEach(file => console.error(`     - ${file}`));
    });
    console.error('');
    hasErrors = true;
  }
  
  // Check domain limits
  const limitViolations = checkDomainLimits(files.filter(f => f.data), config);
  if (limitViolations.length > 0) {
    console.error('❌ Domain limit violations:');
    limitViolations.forEach(violation => {
      console.error(`   ${violation.reason}`);
    });
    console.error('');
    hasErrors = true;
  }
  
  // Summary
  console.log(`\n📊 Validation Summary:`);
  console.log(`   Valid: ${validCount}`);
  console.log(`   Invalid: ${files.length - validCount}`);
  console.log(`   Duplicates: ${duplicates.length}`);
  console.log(`   Limit violations: ${limitViolations.length}`);
  
  if (hasErrors) {
    console.error('\n❌ Validation failed! Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed!');
  }
}

// Run validation
if (require.main === module) {
  validateAllDomains();
}

module.exports = {
  validateAllDomains,
  validateDomainFile,
  getAllDomainFiles,
  loadConfig
};
