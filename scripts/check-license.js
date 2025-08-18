#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Metisse
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let hasErrors = false;

function error(message) {
  console.error(`❌ ${message}`);
  hasErrors = true;
}

function success(message) {
  console.log(`✅ ${message}`);
}

function checkFileExists(filePath, description) {
  const fullPath = join(rootDir, filePath);
  if (existsSync(fullPath)) {
    success(`${description} exists at ${filePath}`);
    return true;
  } else {
    error(`${description} missing at ${filePath}`);
    return false;
  }
}

function checkLicenseHeader(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(0, 20); // Check first 20 lines
    
    const hasApacheLicense = lines.some(line => 
      line.includes('Apache-2.0') || 
      line.includes('Licensed under the Apache License, Version 2.0')
    );
    
    const hasCopyright = lines.some(line => 
      line.includes('Copyright') && 
      (line.includes('Metisse') || line.includes('Google LLC'))
    );
    
    if (hasApacheLicense && hasCopyright) {
      return true;
    }
    
    return false;
  } catch (err) {
    error(`Failed to read ${filePath}: ${err.message}`);
    return false;
  }
}

function main() {
  console.log('🔍 Checking license compliance...\n');
  
  // Check LICENSE file exists
  checkFileExists('LICENSE', 'LICENSE file');
  
  // Check NOTICE file exists
  if (checkFileExists('NOTICE', 'NOTICE file')) {
    // Verify NOTICE contains required attribution
    try {
      const noticeContent = readFileSync(join(rootDir, 'NOTICE'), 'utf8');
      if (noticeContent.includes('substantial changes by Metisse')) {
        success('NOTICE file contains required attribution');
      } else {
        error('NOTICE file missing "substantial changes by Metisse" phrase');
      }
      
      if (noticeContent.includes('Google LLC')) {
        success('NOTICE file contains upstream attribution');
      } else {
        error('NOTICE file missing upstream attribution to Google LLC');
      }
    } catch (err) {
      error(`Failed to read NOTICE file: ${err.message}`);
    }
  }
  
  // Check TypeScript files in src/ for license headers
  console.log('\n🔍 Checking TypeScript files for license headers...');
  
  function findTsFiles(dir, files = []) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          findTsFiles(fullPath, files);
        } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      // Directory doesn't exist or can't be read
    }
    return files;
  }
  
  try {
    const srcDir = join(rootDir, 'src');
    const tsFiles = findTsFiles(srcDir);
    
    if (tsFiles.length === 0) {
      console.log('ℹ️  No TypeScript files found in src/ directory');
    } else {
      let validHeaders = 0;
      
      for (const file of tsFiles) {
        const relativePath = file.replace(rootDir + '/', '');
        if (checkLicenseHeader(file)) {
          validHeaders++;
        } else {
          error(`${relativePath} missing proper Apache 2.0 license header`);
        }
      }
      
      if (validHeaders === tsFiles.length) {
        success(`All ${tsFiles.length} TypeScript files have proper license headers`);
      } else {
        error(`${tsFiles.length - validHeaders} TypeScript files missing license headers`);
      }
    }
  } catch (err) {
    error(`Failed to scan TypeScript files: ${err.message}`);
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (hasErrors) {
    console.error('❌ License compliance check failed');
    process.exit(1);
  } else {
    console.log('✅ License compliance check passed');
    process.exit(0);
  }
}

try {
  main();
} catch (err) {
  console.error('Fatal error:', err);
  process.exit(1);
}