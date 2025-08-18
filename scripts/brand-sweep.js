#!/usr/bin/env node

/**
 * Brand Sweep Script
 * 
 * Searches for Google, Gemini, and upstream references that need to be replaced
 * with Entole/Metisse branding. Exits with non-zero code if violations are found.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Patterns to search for (case-insensitive)
const BRAND_PATTERNS = [
  // Google branding
  /\bGoogle\b/gi,
  /\bgoogle\b/gi,
  
  // Gemini branding
  /\bGemini\b/gi,
  /\bgemini\b/gi,
  
  // Upstream references that should be replaced
  /googleapis\.com/gi,
  /ai\.google\.dev/gi,
  /cloud\.google\.com/gi,
  /developers\.google\.com/gi,
  
  // CLI references that should be "entole"
  /gemini-cli/gi,
  /google.*cli/gi,
  
  // Package/binary names
  /"gemini"/gi,
  /bin.*gemini/gi,
  /command.*gemini/gi,
];

// Files and directories to exclude from scanning
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /\.nyc_output/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.log$/,
  /\.sqlite3?$/,
  // Keep LICENSE file as-is (upstream requirement)
  /^LICENSE$/,
  // Keep NOTICE file references to upstream (required for attribution)
  /^NOTICE$/,
];

// File extensions to scan
const SCAN_EXTENSIONS = [
  '.js', '.ts', '.tsx', '.jsx',
  '.json', '.yaml', '.yml',
  '.md', '.txt',
  '.html', '.htm',
  '.sh', '.bash',
  '.config.js', '.config.ts'
];

// Special handling for certain patterns in specific contexts
const ALLOWED_CONTEXTS = [
  // Allow "Google" in LICENSE and NOTICE files for attribution
  { pattern: /\bGoogle\b/gi, files: [/LICENSE$/, /NOTICE$/] },
  // Allow upstream references in NOTICE for attribution
  { pattern: /googleapis\.com/gi, files: [/NOTICE$/] },
  { pattern: /ai\.google\.dev/gi, files: [/NOTICE$/] },
  // Allow in comments that reference upstream for attribution
  { pattern: /\bGoogle\b/gi, context: /\/\*.*upstream.*\*\/|\/\/.*upstream/gi },
  { pattern: /\bGemini\b/gi, context: /\/\*.*upstream.*\*\/|\/\/.*upstream/gi },
];

class BrandSweep {
  constructor() {
    this.violations = [];
    this.scannedFiles = 0;
  }

  /**
   * Check if a file should be excluded from scanning
   */
  shouldExclude(filePath) {
    return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if a file extension should be scanned
   */
  shouldScan(filePath) {
    const ext = extname(filePath);
    return SCAN_EXTENSIONS.includes(ext) || !ext; // Include files without extension
  }

  /**
   * Check if a violation is allowed in the given context
   */
  isAllowedViolation(pattern, filePath, line, lineNumber) {
    // Check file-specific allowances
    const fileAllowance = ALLOWED_CONTEXTS.find(ctx => 
      ctx.pattern.source === pattern.source && 
      ctx.files && 
      ctx.files.some(filePattern => filePattern.test(filePath))
    );
    
    if (fileAllowance) {
      return true;
    }

    // Check context-specific allowances (e.g., in comments)
    const contextAllowance = ALLOWED_CONTEXTS.find(ctx => 
      ctx.pattern.source === pattern.source && 
      ctx.context && 
      ctx.context.test(line)
    );

    return !!contextAllowance;
  }

  /**
   * Scan a single file for brand violations
   */
  scanFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        BRAND_PATTERNS.forEach(pattern => {
          // Reset regex lastIndex to avoid issues with global flag
          pattern.lastIndex = 0;
          
          let match;
          while ((match = pattern.exec(line)) !== null) {
            if (!this.isAllowedViolation(pattern, filePath, line, lineNumber)) {
              this.violations.push({
                file: filePath,
                line: lineNumber,
                column: match.index + 1,
                match: match[0],
                pattern: pattern.source,
                context: line.trim()
              });
            }
          }
        });
      });
      
      this.scannedFiles++;
    } catch (error) {
      console.warn(`Warning: Could not scan ${filePath}: ${error.message}`);
    }
  }

  /**
   * Recursively scan directory
   */
  scanDirectory(dirPath) {
    try {
      const entries = readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const relativePath = fullPath.replace(rootDir + '/', '');
        
        if (this.shouldExclude(relativePath)) {
          continue;
        }
        
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.scanDirectory(fullPath);
        } else if (stat.isFile() && this.shouldScan(fullPath)) {
          this.scanFile(relativePath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Run the brand sweep
   */
  run() {
    console.log('🔍 Running brand sweep...');
    console.log(`Scanning from: ${rootDir}`);
    console.log('');
    
    this.scanDirectory(rootDir);
    
    console.log(`📊 Scanned ${this.scannedFiles} files`);
    console.log('');
    
    if (this.violations.length === 0) {
      console.log('✅ No brand violations found!');
      return 0;
    }
    
    console.log(`❌ Found ${this.violations.length} brand violations:`);
    console.log('');
    
    // Group violations by file
    const violationsByFile = {};
    this.violations.forEach(violation => {
      if (!violationsByFile[violation.file]) {
        violationsByFile[violation.file] = [];
      }
      violationsByFile[violation.file].push(violation);
    });
    
    // Display violations
    Object.entries(violationsByFile).forEach(([file, violations]) => {
      console.log(`📄 ${file}:`);
      violations.forEach(violation => {
        console.log(`  Line ${violation.line}:${violation.column} - "${violation.match}"`);
        console.log(`    Context: ${violation.context}`);
      });
      console.log('');
    });
    
    console.log('💡 Next steps:');
    console.log('  1. Replace Google/Gemini references with Entole/Metisse');
    console.log('  2. Update URLs to point to Metisse organization');
    console.log('  3. Rename CLI commands and binary references');
    console.log('  4. Update package.json metadata');
    console.log('');
    console.log('ℹ️  Note: Some references in LICENSE and NOTICE files are intentionally preserved for attribution');
    
    return 1; // Exit with error code
  }
}

// Run the brand sweep
const sweep = new BrandSweep();
const exitCode = sweep.run();
process.exit(exitCode);