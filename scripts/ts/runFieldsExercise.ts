// ============================================================================
// FILE: scripts/ts/runFieldsExercise.ts
// PURPOSE: The "Runner" script. It uses tools from createFields.ts to build the app.
// ============================================================================

import * as path from 'path';

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

    // 0. Configuration for Name Field
    const propertyNameOptions: NameFieldOptions = {
        label: 'Property Name',       
        type: 'AutoNumber',           
        displayFormat: 'PROP-{0000}', 
        startingNumber: 1             
    };

    // 1. Create Object
    const fieldsPath = createObject(
        /* parentDirectory */  ROOT_DIR, 
        /* objectName */       'Property', 
        /* label */            'Property', 
        /* pluralLabel */      'Properties',
        /* nameFieldOptions */ propertyNameOptions
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
    // createPermissionSet('Property', ROOT_DIR); 

    // 6. Add to Sales App
    addTabToApp(
        /* targetApp */    'standard__Sales', 
        /* targetObject */ 'Property', 
        /* rootDir */      ROOT_DIR
    );

    // 7. Create Data
    const myRecords: RecordDefinition[] = [
        { 
            Price__c: 500000 
            // Name is omitted because we passed AutoNumber options below!
        } 
    ];

    createRecords(
        /* targetObject */     'Property', 
        /* recordList */       myRecords, 
        /* rootDir */          ROOT_DIR,
        /* nameFieldOptions */ propertyNameOptions // Pass the options here!
    );
    
    console.log('✨ Script Finished Successfully.');
}