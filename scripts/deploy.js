#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Cloudflare API configuration
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const DOMAIN_NAME = process.env.DOMAIN_NAME || 'loves-to.dev';

if (!CF_API_TOKEN || !CF_ZONE_ID) {
  console.error('❌ Missing required environment variables:');
  console.error('   CLOUDFLARE_API_TOKEN');
  console.error('   CLOUDFLARE_ZONE_ID');
  process.exit(1);
}

/**
 * Make Cloudflare API request
 */
async function cloudflareRequest(endpoint, method = 'GET', data = null) {
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(result.errors)}`);
  }
  
  return result.result;
}

/**
 * Get all existing DNS records for the domain
 */
async function getExistingRecords() {
  console.log('📡 Fetching existing DNS records...');
  
  const records = await cloudflareRequest(`/zones/${CF_ZONE_ID}/dns_records?type=CNAME`);
  
  // Filter only subdomains of our domain
  const subdomainRecords = records.filter(record => 
    record.name.endsWith(`.${DOMAIN_NAME}`) && 
    record.name !== DOMAIN_NAME
  );
  
  console.log(`   Found ${subdomainRecords.length} existing CNAME records`);
  return subdomainRecords;
}

/**
 * Get all domain files that should have DNS records
 */
function getDomainFiles() {
  const domainsDir = path.join(process.cwd(), 'domains');
  
  if (!fs.existsSync(domainsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(domainsDir)
    .filter(file => file.endsWith('.json') && file !== 'reserved')
    .map(file => {
      const filePath = path.join(domainsDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        username: file.replace('.json', ''),
        subdomain: `${file.replace('.json', '')}.${DOMAIN_NAME}`,
        target: content.records.CNAME,
        email: content.owner.email
      };
    });
  
  // Also include reserved domains
  const reservedDir = path.join(domainsDir, 'reserved');
  if (fs.existsSync(reservedDir)) {
    const reservedFiles = fs.readdirSync(reservedDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(reservedDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          username: file.replace('.json', ''),
          subdomain: `${file.replace('.json', '')}.${DOMAIN_NAME}`,
          target: content.records.CNAME,
          email: content.owner.email,
          reserved: true
        };
      });
    
    files.push(...reservedFiles);
  }
  
  return files;
}

/**
 * Create a new DNS record
 */
async function createDNSRecord(subdomain, target) {
  console.log(`➕ Creating: ${subdomain} → ${target}`);
  
  await cloudflareRequest(`/zones/${CF_ZONE_ID}/dns_records`, 'POST', {
    type: 'CNAME',
    name: subdomain,
    content: target,
    ttl: 300, // 5 minutes
    comment: `Managed by loves-to.dev - ${new Date().toISOString()}`
  });
}

/**
 * Update an existing DNS record
 */
async function updateDNSRecord(recordId, subdomain, target) {
  console.log(`🔄 Updating: ${subdomain} → ${target}`);
  
  await cloudflareRequest(`/zones/${CF_ZONE_ID}/dns_records/${recordId}`, 'PUT', {
    type: 'CNAME',
    name: subdomain,
    content: target,
    ttl: 300,
    comment: `Managed by loves-to.dev - ${new Date().toISOString()}`
  });
}

/**
 * Delete a DNS record
 */
async function deleteDNSRecord(recordId, subdomain) {
  console.log(`❌ Deleting: ${subdomain}`);
  
  await cloudflareRequest(`/zones/${CF_ZONE_ID}/dns_records/${recordId}`, 'DELETE');
}

/**
 * Main deployment function
 */
async function deployDNS() {
  try {
    console.log(`🚀 Starting DNS deployment for ${DOMAIN_NAME}...\n`);
    
    // Get current state
    const [existingRecords, domainFiles] = await Promise.all([
      getExistingRecords(),
      getDomainFiles()
    ]);
    
    console.log(`📋 Found ${domainFiles.length} domain file(s) to process\n`);
    
    // Create maps for easier lookup
    const existingMap = new Map();
    existingRecords.forEach(record => {
      existingMap.set(record.name, record);
    });
    
    const desiredMap = new Map();
    domainFiles.forEach(domain => {
      desiredMap.set(domain.subdomain, domain);
    });
    
    let created = 0;
    let updated = 0;
    let deleted = 0;
    
    // Process desired records
    for (const domain of domainFiles) {
      const existing = existingMap.get(domain.subdomain);
      
      if (existing) {
        // Update if target changed
        if (existing.content !== domain.target) {
          await updateDNSRecord(existing.id, domain.subdomain, domain.target);
          updated++;
        } else {
          console.log(`✅ No change: ${domain.subdomain} → ${domain.target}`);
        }
      } else {
        // Create new record
        await createDNSRecord(domain.subdomain, domain.target);
        created++;
      }
    }
    
    // Delete records that no longer exist in files
    for (const record of existingRecords) {
      if (!desiredMap.has(record.name)) {
        await deleteDNSRecord(record.id, record.name);
        deleted++;
      }
    }
    
    // Summary
    console.log(`\n📊 Deployment Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   No change: ${domainFiles.length - created - updated}`);
    
    console.log(`\n✅ DNS deployment completed successfully!`);
    
  } catch (error) {
    console.error(`\n❌ Deployment failed:`, error.message);
    process.exit(1);
  }
}

// Add fetch polyfill for Node.js < 18
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

// Run deployment
if (require.main === module) {
  deployDNS();
}

module.exports = { deployDNS };