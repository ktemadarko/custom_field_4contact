// ============================================================================
// FILE: scripts/ts/runFieldsExercise.ts
// PURPOSE: The "Runner" script. It uses tools from createFields.ts to build the app.
// ============================================================================

import * as path from 'path';

// Custom Tools
import { 
    createObject, 
    createFields, 
    createTab, 
    addTabToApp, 
    createRecords, 
    FieldDefinition, 
    NameFieldOptions 
} from './createFields';

// Permission Set Generator
import { createPermissionSet } from './createPermissionSet';

// Layout Helper
import { addFieldToLayout } from './updateLayouts';

// ============================================================================
// EXECUTION
// ============================================================================

const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('runFieldsExercise.ts');

if (isRunningDirectly) {
    console.log('🚀 Starting Automation Script...');

    const ROOT_DIR = path.join(process.cwd(), 'force-app/main/default/objects');

    // 0. Name Config
    const offerNameOptions: NameFieldOptions = {
        label: 'Offer Name',          
        type: 'AutoNumber',           
        displayFormat: 'OF-{0000}',   
        startingNumber: 1             
    };

    // 1. Create Object
    const fieldsPath = createObject(ROOT_DIR, 'Offer', 'Offer', 'Offers', offerNameOptions);

    // 2. Define Fields
    const myFields: FieldDefinition[] = [
        { 
            name: 'Offer_Amount',          
            label: 'Offer Amount',         
            type: 'Currency', 
            description: 'The monetary value of the offer', 
            required: true 
        },
        { 
            name: 'Target_Close_Date',     
            label: 'Target Close Date',    
            type: 'Date', 
            description: 'Proposed date to close the deal',
            required: true
        }
    ];

    // 3. Generate Fields
    createFields(fieldsPath, myFields);

    // 4. Create Tab
    createTab('Offer', ROOT_DIR, 'Custom1: Heart');

    // 5. Create Permission Set (Just the XML file)
    createPermissionSet('Offer', ROOT_DIR); 

    // 6. Add to Sales App
    addTabToApp('standard__Sales', 'Offer', ROOT_DIR);

    // 7. Update Page Layouts
    addFieldToLayout('Offer-Offer Layout', 'Offer_Amount__c', ROOT_DIR);
    addFieldToLayout('Offer-Offer Layout', 'Target_Close_Date__c', ROOT_DIR);

    // REMOVED: Step 8 (Assignment) is now gone from here.
    
    console.log('✨ Script Finished Successfully.');
}