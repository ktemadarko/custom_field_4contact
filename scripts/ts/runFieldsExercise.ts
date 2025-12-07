// ============================================================================
// FILE: scripts/ts/runFieldsExercise.ts
// PURPOSE: The "Runner" script. It uses tools from createFields.ts to build the app.
// ============================================================================

import * as path from 'path';

// 1. UPDATED IMPORTS: Added 'NameFieldOptions'
import { 
    createObject, 
    createFields, 
    createTab, 
    addTabToApp, 
    createRecords, 
    FieldDefinition, 
    RecordDefinition,
    NameFieldOptions 
} from './createFields';

// ============================================================================
// EXECUTION
// ============================================================================

const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('runFieldsExercise.ts');

if (isRunningDirectly) {
    console.log('🚀 Starting Automation Script...');

    const ROOT_DIR = path.join(process.cwd(), 'force-app/main/default/objects');

    // 1. Create Object (UPDATED)
    // We now pass a 5th argument to configure the Name field as AutoNumber.
    // I adapted your "Offer" example to fit the "Property" object (e.g. PROP-0001).
    const fieldsPath = createObject(
        /* parentDirectory */  ROOT_DIR, 
        /* objectName */       'Property', 
        /* label */            'Property', 
        /* pluralLabel */      'Properties',
        /* nameFieldOptions */ {
            label: 'Property Name',       // Was "Offer Name"
            type: 'AutoNumber',           // Was "Auto Number"
            displayFormat: 'PROP-{0000}', // Was "OF-{0000}"
            startingNumber: 1             // Was "1"
        }
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

    // 7. Create Data (UPDATED)
    // Since Name is now AutoNumber, we DO NOT provide it in the record data.
    // Salesforce will generate "PROP-0001" automatically on import.
    const myRecords: RecordDefinition[] = [
        { 
            // Name: 'Luxury Villa',  <-- REMOVED (Auto-generated now)
            Price__c: 500000 
        } 
    ];

    createRecords(
        /* targetObject */ 'Property', 
        /* recordList */   myRecords, 
        /* rootDir */      ROOT_DIR
    );
    
    console.log('✨ Script Finished Successfully.');
}