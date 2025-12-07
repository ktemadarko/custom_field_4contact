// ============================================================================
// FILE: scripts/ts/runFieldsExercise.ts
// PURPOSE: The "Runner" script. It uses tools from createFields.ts to build the app.
// ============================================================================

// 1. Import Node.js tools
import * as path from 'path';

// 2. Import our Custom Tools (Named Imports)
import { 
    createObject, 
    createFields, 
    createTab, 
    addTabToApp, 
    createRecords, 
    FieldDefinition, 
    RecordDefinition 
} from './createFields';

// ============================================================================
// EXECUTION
// ============================================================================

// Check if THIS specific file is the one running
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('runFieldsExercise.ts');

if (isRunningDirectly) {
    console.log('🚀 Starting Automation Script...');

    const ROOT_DIR = path.join(process.cwd(), 'force-app/main/default/objects');

    // 1. Create Object
    const fieldsPath = createObject(ROOT_DIR, 'Property', 'Property', 'Properties');

    // 2. Define Fields
    const myFields: FieldDefinition[] = [
        { name: 'Price', type: 'Currency', description: 'Listing Price', required: true }
    ];

    // 3. Generate Fields
    createFields(fieldsPath, myFields);

    // 4. Create Tab
    createTab('Property', ROOT_DIR, 'Custom13: Building');

    // 5. Permission Set (DISABLED)
    // import { createPermissionSet } from './createPermissionSet';
    // createPermissionSet('Property', ROOT_DIR); 

    // 6. Add to Sales App
    addTabToApp('standard__Sales', 'Property', ROOT_DIR);

    // 7. Create Data
    const myRecords: RecordDefinition[] = [
        { Name: 'Luxury Villa', Price__c: 500000 } 
    ];
    createRecords('Property', myRecords, ROOT_DIR);
    
    console.log('✨ Script Finished Successfully.');
}