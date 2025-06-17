#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Get list of reserved usernames from domains/reserved/ folder
 */
function getReservedUsernames() {
  const reservedDir = path.join(process.cwd(), 'domains', 'reserved');
  
  if (!fs.existsSync(reservedDir)) {
    return [];
  }
  
  const files = fs.readdirSync(reservedDir).filter(file => file.endsWith('.json'));
  return files.map(file => file.replace('.json', ''));
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
  
  // Check if reserved
  const reservedUsernames = getReservedUsernames();
  if (reservedUsernames.includes(username)) {
    return { valid: false, reason: 'is a reserved username' };
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
 * Check for duplicate usernames
 */
function checkForDuplicates(files) {
  const usernames = {};
  const duplicates = [];
  
  files.forEach(file => {
    if (usernames[file.username]) {
      duplicates.push({
        username: file.username,
        files: [usernames[file.username], file.filePath]
      });
    } else {
      usernames[file.username] = file.filePath;
    }
  });
  
  return duplicates;
}

/**
 * Validates a single domain JSON file
 */
function validateDomainFile(filePath, filename) {
  const errors = [];
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let domainData;
    
    try {
      domainData = JSON.parse(fileContent);
    } catch (parseError) {
      return {
        success: false,
        errors: [`Invalid JSON format: ${parseError.message}`]
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
      // Validate CNAME record
      if (!domainData.records.CNAME || typeof domainData.records.CNAME !== 'string') {
        errors.push('Missing or invalid "records.CNAME" field');
      } else if (!isValidDomain(domainData.records.CNAME)) {
        errors.push(`Invalid CNAME domain: ${domainData.records.CNAME}`);
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
      errors: [`Error reading file: ${error.message}`]
    };
  }
}

/**
 * Get all domain files (excluding reserved folder)
 */
function getAllDomainFiles() {
  const domainsDir = path.join(process.cwd(), 'domains');
  
  if (!fs.existsSync(domainsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(domainsDir)
    .filter(file => file.endsWith('.json') && file !== 'reserved')
    .map(file => ({
      filePath: path.join(domainsDir, file),
      filename: file.replace('.json', ''),
      username: file.replace('.json', '')
    }));
  
  return files;
}

/**
 * Main validation function
 */
function validateAllDomains() {
  const files = getAllDomainFiles();
  
  if (files.length === 0) {
    console.log('✅ No domain files to validate');
    return;
  }
  
  console.log(`🔍 Validating ${files.length} domain file(s)...\n`);
  
  // Check for duplicates
  const duplicates = checkForDuplicates(files);
  if (duplicates.length > 0) {
    console.error('❌ Duplicate usernames found:');
    duplicates.forEach(dup => {
      console.error(`   Username "${dup.username}" appears in multiple files:`);
      dup.files.forEach(file => console.error(`     - ${file}`));
    });
    console.error('');
  }
  
  let hasErrors = duplicates.length > 0;
  let validCount = 0;
  
  // Validate each file
  files.forEach(file => {
    const result = validateDomainFile(file.filePath, file.filename);
    
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
  
  // Summary
  console.log(`\n📊 Validation Summary:`);
  console.log(`   Valid: ${validCount}`);
  console.log(`   Invalid: ${files.length - validCount}`);
  console.log(`   Reserved usernames: ${getReservedUsernames().length}`);
  
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
  getAllDomainFiles
};