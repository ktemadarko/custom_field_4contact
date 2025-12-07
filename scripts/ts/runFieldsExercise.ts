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

    // 0. Configuration for Name Field (AutoNumber)
    const offerNameOptions: NameFieldOptions = {
        label: 'Offer Name',          // UI Label for the ID column
        type: 'AutoNumber',           // Data Type
        displayFormat: 'OF-{0000}',   // Format
        startingNumber: 1             
    };

    // 1. Create Object: Offer
    const fieldsPath = createObject(
        /* parentDirectory */  ROOT_DIR, 
        /* objectName */       'Offer', 
        /* label */            'Offer', 
        /* pluralLabel */      'Offers',
        /* nameFieldOptions */ offerNameOptions
    );

    // 2. Define Fields
    // We use the new 'label' property to separate API Name from UI Label.
    const myFields: FieldDefinition[] = [
        { 
            name: 'Offer_Amount',          // API Name (becomes Offer_Amount__c)
            label: 'Offer Amount',         // UI Label (Variable nameViewerSees)
            type: 'Currency', 
            description: 'The monetary value of the offer', 
            required: true 
        },
        { 
            name: 'Target_Close_Date',     // API Name (becomes Target_Close_Date__c)
            label: 'Target Close Date',    // UI Label (Variable nameViewerSees)
            type: 'Date', 
            description: 'Proposed date to close the deal',
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
        /* targetObject */ 'Offer', 
        /* rootDir */      ROOT_DIR, 
        /* iconStyle */    'Custom1: Heart' // Changed style for variety
    );

    // 5. Permission Set (DISABLED)
    // import { createPermissionSet } from './createPermissionSet';
    // createPermissionSet('Offer', ROOT_DIR); 

    // 6. Add to Sales App
    addTabToApp(
        /* targetApp */    'standard__Sales', 
        /* targetObject */ 'Offer', 
        /* rootDir */      ROOT_DIR
    );

    // 7. Create Data (DISABLED)
    // We define the data structure but DO NOT run the creation function.
    const myRecords: RecordDefinition[] = [
        { 
            // Name is omitted (AutoNumber)
            Offer_Amount__c: 120000,
            Target_Close_Date__c: '2023-12-31'
        } 
    ];

    // createRecords(
    //     /* targetObject */     'Offer', 
    //     /* recordList */       myRecords, 
    //     /* rootDir */          ROOT_DIR,
    //     /* nameFieldOptions */ offerNameOptions
    // );
    
    console.log('✨ Script Finished Successfully.');
}