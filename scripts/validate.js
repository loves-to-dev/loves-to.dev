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
  
  // Load reserved usernames
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
 * Validates if a string is a valid username
 */
function isValidUsername(username) {
  // Must be lowercase, alphanumeric, and may include hyphens
  const usernameRegex = /^[a-z0-9-]+$/;
  
  if (!usernameRegex.test(username)) {
    return { valid: false, reason: 'must be lowercase, alphanumeric, and may include hyphens only' };
  }
  
  // Cannot start or end with hyphen
  if (username.startsWith('-') || username.endsWith('-')) {
    return { valid: false, reason: 'cannot start or end with hyphen' };
  }
  
  // Cannot contain consecutive hyphens
  if (username.includes('--')) {
    return { valid: false, reason: 'cannot contain consecutive hyphens' };
  }
  
  // Must be between 1 and 63 characters (DNS limit)
  if (username.length < 1 || username.length > 63) {
    return { valid: false, reason: 'must be between 1 and 63 characters' };
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
 * Check domain ownership limits
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
        reason: `User "${username}" has ${count} domains but is not in trusted list (limit: 1)`
      });
    }
  });
  
  return violations;
}

/**
 * Check for duplicate usernames across all files
 */
function checkForDuplicates(files) {
  const usernames = {};
  const duplicates = [];
  
  files.forEach(file => {
    const username = file.data?.owner?.username;
    if (!username) return;
    
    if (usernames[username]) {
      duplicates.push({
        username: username,
        files: [usernames[username], file.filePath]
      });
    } else {
      usernames[username] = file.filePath;
    }
  });
  
  return duplicates;
}

/**
 * Validates a single domain JSON file
 */
function validateDomainFile(filePath, filename, config) {
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
      // Validate username
      if (!domainData.owner.username || typeof domainData.owner.username !== 'string') {
        errors.push('Missing or invalid "owner.username" field');
      } else {
        const username = domainData.owner.username;
        
        // Check if filename matches username
        if (filename !== username) {
          errors.push(`Filename "${filename}" must match username "${username}"`);
        }
        
        // Validate username format
        const usernameValidation = isValidUsername(username);
        if (!usernameValidation.valid) {
          errors.push(`Invalid username "${username}": ${usernameValidation.reason}`);
        }
        
        // Check if reserved
        if (config.reserved.includes(username)) {
          errors.push(`Username "${username}" is reserved`);
        }
      }
      
      // Validate email
      if (!domainData.owner.email || typeof domainData.owner.email !== 'string') {
        errors.push('Missing or invalid "owner.email" field');
      } else if (!isValidEmail(domainData.owner.email)) {
        errors.push(`Invalid email address: ${domainData.owner.email}`);
      }
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
      filename: file.replace('.json', ''),
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
  
  console.log(`📋 Configuration loaded:`);
  console.log(`   Reserved usernames: ${config.reserved.length}`);
  console.log(`   Trusted users: ${config.trusted.length}\n`);
  
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
    const result = validateDomainFile(file.filePath, file.filename, config);
    file.data = result.data;
    
    if (result.success) {
      console.log(`✅ ${file.filename}.json`);
      validCount++;
    } else {
      console.error(`❌ ${file.filename}.json`);
      result.errors.forEach(error => {
        console.error(`   ${error}`);
      });
      console.error('');
      hasErrors = true;
    }
  });
  
  // Check for duplicates
  const duplicates = checkForDuplicates(files.filter(f => f.data));
  if (duplicates.length > 0) {
    console.error('❌ Duplicate usernames found:');
    duplicates.forEach(dup => {
      console.error(`   Username "${dup.username}" appears in multiple files:`);
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
