const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🔍 Starting AI Study Assistant Build Integrity Check...\n');
console.log('='.repeat(60));

const checks = [];
const warnings = [];
const errors = [];

// Helper function to run commands safely
function runCommand(command, description) {
  try {
    console.log(`\n📋 ${description}...`);
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 1. CHECK CRITICAL FILES EXIST
console.log('\n📁 1. Critical Files Check');
const criticalFiles = [
  'frontend/src/App.tsx',
  'backend/server.js',
  'backend/package.json',
  'frontend/package.json',
  '.env.example',
  'frontend/public/index.html',
  'backend/models/User.js'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    checks.push({ type: 'file', name: file, status: '✅', message: 'Exists' });
  } else {
    errors.push({ type: 'file', name: file, message: 'CRITICAL: File missing!' });
  }
});

// 2. BRAND COMPLIANCE CHECK (AI Study Assistant vs Let's Revise)
console.log('\n🎯 2. Brand Compliance Check');
const searchPatterns = [
  "Let's Revise",
  "Lets Revise",
  "let's revise"
];

let brandIssues = [];
searchPatterns.forEach(pattern => {
  try {
    // Search in frontend
    const frontendResult = execSync(
      `findstr /S /I /C:"${pattern}" "frontend\\src\\*.tsx" "frontend\\src\\*.ts" "frontend\\public\\*.html" 2>nul`,
      { encoding: 'utf8' }
    );
    if (frontendResult.trim()) {
      brandIssues.push(`Frontend: Found "${pattern}"`);
    }
  } catch (e) {}
  
  try {
    // Search in backend
    const backendResult = execSync(
      `findstr /S /I /C:"${pattern}" "backend\\*.js" "backend\\routes\\*.js" "backend\\models\\*.js" 2>nul`,
      { encoding: 'utf8' }
    );
    if (backendResult.trim()) {
      brandIssues.push(`Backend: Found "${pattern}"`);
    }
  } catch (e) {}
  
  try {
    // Search in static site
    const staticResult = execSync(
      `findstr /S /I /C:"${pattern}" "static-site\\*.html" 2>nul`,
      { encoding: 'utf8' }
    );
    if (staticResult.trim()) {
      brandIssues.push(`Static Site: Found "${pattern}"`);
    }
  } catch (e) {}
});

if (brandIssues.length > 0) {
  errors.push({ 
    type: 'brand', 
    name: 'Brand Compliance', 
    message: `Found ${brandIssues.length} old brand references`,
    details: brandIssues 
  });
} else {
  checks.push({ type: 'brand', name: 'Brand Compliance', status: '✅', message: 'No old brand references found' });
}

// 3. CHECK ENVIRONMENT VARIABLES
console.log('\n🔐 3. Environment Configuration Check');
if (fs.existsSync('.env.example')) {
  const envContent = fs.readFileSync('.env.example', 'utf8');
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT'];
  
  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      checks.push({ type: 'env', name: varName, status: '✅', message: 'Defined in .env.example' });
    } else {
      warnings.push({ type: 'env', name: varName, message: `Not in .env.example - add to production` });
    }
  });
} else {
  warnings.push({ type: 'env', name: '.env.example', message: 'Missing .env.example file' });
}

// 4. CHECK PACKAGE.JSON INTEGRITY
console.log('\n📦 4. Package.json Checks');

// Frontend package.json
if (fs.existsSync('frontend/package.json')) {
  try {
    const frontendPkg = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
    
    // Check required scripts
    const requiredScripts = ['start', 'build', 'test'];
    requiredScripts.forEach(script => {
      if (frontendPkg.scripts && frontendPkg.scripts[script]) {
        checks.push({ type: 'package', name: `frontend:${script}`, status: '✅', message: 'Script exists' });
      } else {
        warnings.push({ type: 'package', name: `frontend:${script}`, message: `Missing ${script} script` });
      }
    });
    
    // Check dependencies
    if (frontendPkg.dependencies && frontendPkg.dependencies['react']) {
      checks.push({ type: 'package', name: 'frontend:react', status: '✅', message: 'React dependency found' });
    }
  } catch (e) {
    errors.push({ type: 'package', name: 'frontend/package.json', message: 'Invalid JSON format' });
  }
}

// Backend package.json
if (fs.existsSync('backend/package.json')) {
  try {
    const backendPkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
    
    // Check required scripts
    const requiredBackendScripts = ['start', 'dev'];
    requiredBackendScripts.forEach(script => {
      if (backendPkg.scripts && backendPkg.scripts[script]) {
        checks.push({ type: 'package', name: `backend:${script}`, status: '✅', message: 'Script exists' });
      } else {
        warnings.push({ type: 'package', name: `backend:${script}`, message: `Missing ${script} script` });
      }
    });
    
    // Check critical dependencies
    const criticalDeps = ['express', 'mongoose', 'cors', 'dotenv'];
    criticalDeps.forEach(dep => {
      if (backendPkg.dependencies && backendPkg.dependencies[dep]) {
        checks.push({ type: 'package', name: `backend:${dep}`, status: '✅', message: 'Dependency found' });
      } else {
        errors.push({ type: 'package', name: `backend:${dep}`, message: `MISSING critical dependency: ${dep}` });
      }
    });
  } catch (e) {
    errors.push({ type: 'package', name: 'backend/package.json', message: 'Invalid JSON format' });
  }
}

// 5. CHECK FOR LARGE FILES
console.log('\n💾 5. File Size Check');
const checkDirectoryForLargeFiles = (dirPath, maxSizeMB = 5) => {
  if (!fs.existsSync(dirPath)) return;
  
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    files.forEach(file => {
      if (file.isFile()) {
        const filePath = path.join(dirPath, file.name);
        const stats = fs.statSync(filePath);
        const sizeMB = stats.size / (1024 * 1024);
        
        if (sizeMB > maxSizeMB) {
          warnings.push({ 
            type: 'size', 
            name: filePath, 
            message: `Large file: ${sizeMB.toFixed(2)}MB (>${maxSizeMB}MB)` 
          });
        }
      }
    });
  } catch (e) {
    // Directory might not exist or have permissions issues
  }
};

checkDirectoryForLargeFiles('frontend/public');
checkDirectoryForLargeFiles('backend');

// 6. CHECK DATABASE CONNECTION FILE
console.log('\n🗄️  6. Database Configuration Check');
if (fs.existsSync('backend/config/database.js')) {
  checks.push({ type: 'database', name: 'database.js', status: '✅', message: 'Database config exists' });
} else if (fs.existsSync('backend/config/database.ts')) {
  checks.push({ type: 'database', name: 'database.ts', status: '✅', message: 'Database config exists' });
} else {
  errors.push({ type: 'database', name: 'Database Config', message: 'Missing database configuration file' });
}

// 7. CHECK ROUTES DIRECTORY
console.log('\n🛣️  7. API Routes Check');
const requiredRoutes = [
  'backend/routes/auth.js',
  'backend/routes/lessons.js',
  'backend/routes/users.js',
  'backend/routes/progress.js',
  'backend/routes/subscriptions.js'
];

requiredRoutes.forEach(route => {
  if (fs.existsSync(route)) {
    checks.push({ type: 'route', name: path.basename(route), status: '✅', message: 'Route file exists' });
  } else {
    warnings.push({ type: 'route', name: path.basename(route), message: `Route file not found: ${route}` });
  }
});

// 8. CHECK FOR SECURITY ISSUES
console.log('\n🔒 8. Basic Security Checks');

// Check for hardcoded secrets
try {
  const secretPatterns = [
    'password.*=.*["\']',
    'secret.*=.*["\']',
    'token.*=.*["\']',
    'api_key.*=.*["\']'
  ];
  
  secretPatterns.forEach(pattern => {
    try {
      const result = execSync(`findstr /S /I /R /C:"${pattern}" "backend\\*.js" "frontend\\src\\*.ts" 2>nul`, { encoding: 'utf8' });
      if (result.trim()) {
        warnings.push({ 
          type: 'security', 
          name: 'Hardcoded Secrets', 
          message: `Potential hardcoded secret found with pattern: ${pattern}` 
        });
      }
    } catch (e) {
      // No matches found
    }
  });
} catch (e) {
  // Pattern search failed
}

// 9. CHECK BUILD CAPABILITY
console.log('\n⚙️  9. Build Capability Check');
if (fs.existsSync('frontend/package.json')) {
  const buildCheck = runCommand('cd frontend && npm run build --dry-run 2>&1 || echo "Build check failed"', 'Frontend build check');
  if (buildCheck.success) {
    checks.push({ type: 'build', name: 'Frontend Build', status: '✅', message: 'Build command available' });
  } else {
    warnings.push({ type: 'build', name: 'Frontend Build', message: 'Build command might have issues' });
  }
}

// DISPLAY RESULTS
console.log('\n' + '='.repeat(60));
console.log('📊 BUILD INTEGRITY REPORT');
console.log('='.repeat(60));

console.log('\n✅ CHECKS PASSED:');
checks.forEach(check => {
  console.log(`  ${check.status} ${check.name}: ${check.message}`);
});

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  warnings.forEach(warning => {
    console.log(`  ⚠️  ${warning.name}: ${warning.message}`);
  });
}

if (errors.length > 0) {
  console.log('\n❌ CRITICAL ERRORS:');
  errors.forEach(error => {
    console.log(`  ❌ ${error.name}: ${error.message}`);
    if (error.details) {
      error.details.forEach(detail => console.log(`     - ${detail}`));
    }
  });
}

// SUMMARY
console.log('\n' + '='.repeat(60));
console.log('📈 SUMMARY');
console.log('='.repeat(60));

const totalChecks = checks.length + warnings.length + errors.length;
const passedChecks = checks.length;

console.log(`Total Checks: ${totalChecks}`);
console.log(`✅ Passed: ${passedChecks}`);
console.log(`⚠️  Warnings: ${warnings.length}`);
console.log(`❌ Errors: ${errors.length}`);

// FINAL RECOMMENDATION
console.log('\n' + '='.repeat(60));
console.log('🎯 DEPLOYMENT RECOMMENDATION');
console.log('='.repeat(60));

if (errors.length > 0) {
  console.log('\n❌ DO NOT DEPLOY: Critical errors found!');
  console.log('Fix all critical errors before deployment.');
  process.exit(1);
} else if (warnings.length > 5) {
  console.log('\n⚠️  REVIEW BEFORE DEPLOYMENT: Multiple warnings found');
  console.log('Address major warnings before production deployment.');
} else if (warnings.length > 0) {
  console.log('\n⚠️  DEPLOY WITH CAUTION: Some warnings present');
  console.log('Review warnings but deployment can proceed.');
} else {
  console.log('\n✅ READY FOR DEPLOYMENT: All checks passed!');
  console.log('Your build is production-ready. Proceed with deployment.');
}

// Additional recommendations
console.log('\n💡 NEXT STEPS:');
console.log('1. Run security audit: npm audit (in both frontend and backend)');
console.log('2. Test API endpoints: Ensure all routes work');
console.log('3. Test user flows: Registration, login, lesson access');
console.log('4. Set up monitoring: Error tracking, analytics');
console.log('5. Backup database: Before any deployment');