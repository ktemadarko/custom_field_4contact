// ============================================================================
// FILE: scripts/ts/assignPermission.ts
// PURPOSE: Assigns a Permission Set to the current user (Admin)
// ============================================================================
import { exec } from 'child_process';

/**
 * Assigns a Permission Set to the default user of the target Org.
 */
export function assignPermissionSet(permSetName: string, targetOrg: string): void {
    
    console.log(`⏳ Attempting to assign Permission Set: ${permSetName}...`);

    const command = `sf org assign permset --name ${permSetName} --target-org ${targetOrg}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log(`❌ Error assigning permission.`);
            console.log(`   (Make sure you have run 'npm run deploy' first!)`);
            console.error(stderr);
            return;
        }
        
        if (stdout) {
            console.log(`✅ Success! Assigned '${permSetName}' to user Admin.`);
        }
    });
}

// ============================================================================
// EXECUTION BLOCK (Standalone Mode)
// ============================================================================
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('assignPermission.ts');

if (isRunningDirectly) {
    // HARDCODED CONFIGURATION FOR THIS RUN
    const TARGET_ORG = 'my_dev_org'; 
    const PERM_SET_NAME = 'Offer_Manager';

    assignPermissionSet(PERM_SET_NAME, TARGET_ORG);
}