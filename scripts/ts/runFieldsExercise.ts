// ============================================================================
// FILE: scripts/ts/runFieldsExercise.ts
// PURPOSE: The "Runner" script. It uses tools from createFields.ts to build the app.
// ============================================================================

import * as path from 'path';

// Import our Custom Tools
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

const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('runFieldsExercise.ts');

if (isRunningDirectly) {
    console.log('🚀 Starting Automation Script...');

    const ROOT_DIR = path.join(process.cwd(), 'force-app/main/default/objects');

    // 1. Create Object
    // We use inline comments /* paramName */ to make it clear what each argument is.
    const fieldsPath = createObject(
        /* parentDirectory */ ROOT_DIR, 
        /* objectName */      'Property', 
        /* label */           'Property', 
        /* pluralLabel */     'Properties'
    );

    // 2. Define Fields
    const myFields: FieldDefinition[] = [
        { 
            name: 'Price', 
            type: 'Currency', 
            description: 'Listing Price', 
            required: true 
        }
    ];

    // 3. Generate Fields
    createFields(
        /* fieldsDir */ fieldsPath, 
        /* fieldList */ myFields
    );

    // 4. Create Tab
    createTab(
        /* targetObject */ 'Property', 
        /* rootDir */      ROOT_DIR, 
        /* iconStyle */    'Custom13: Building'
    );

    // 5. Permission Set (DISABLED)
    // import { createPermissionSet } from './createPermissionSet';
    // createPermissionSet(/* targetObject */ 'Property', /* rootDir */ ROOT_DIR); 

    // 6. Add to Sales App
    addTabToApp(
        /* targetApp */    'standard__Sales', 
        /* targetObject */ 'Property', 
        /* rootDir */      ROOT_DIR
    );

    // 7. Create Data
    const myRecords: RecordDefinition[] = [
        { Name: 'Luxury Villa', Price__c: 500000 } 
    ];

    createRecords(
        /* targetObject */ 'Property', 
        /* recordList */   myRecords, 
        /* rootDir */      ROOT_DIR
    );
    
    console.log('✨ Script Finished Successfully.');
}