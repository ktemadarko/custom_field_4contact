// ============================================================================
// FILE: scripts/ts/runFieldsExercise.ts
// PURPOSE: The "Runner" script. It uses tools from createFields.ts to build the app.
// ============================================================================

import * as path from 'path';

// Import Custom Tools
import { 
    createObject, 
    createFields, 
    createTab, 
    addTabToApp, 
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

    // 1. Configure AutoNumber Name
    const offerNameOptions: NameFieldOptions = {
        label: 'Offer Name',          
        type: 'AutoNumber',           
        displayFormat: 'OF-{0000}',   
        startingNumber: 1             
    };

    // 2. Create Object: Offer
    const fieldsPath = createObject(
        ROOT_DIR, 
        'Offer', 
        'Offer', 
        'Offers',
        offerNameOptions
    );

    // 3. Define Fields (Labels, Description, Required)
    const myFields: FieldDefinition[] = [
        { 
            name: 'Offer_Amount',          
            label: 'Offer Amount',         
            type: 'Currency' 
        },
        { 
            name: 'Target_Close_Date',     
            label: 'Target Close Date',    
            type: 'Date'
        }
    ];

    // 4. Generate Fields
    createFields(fieldsPath, myFields);

    // 5. Create Tab
    createTab('Offer', ROOT_DIR, 'Custom1: Heart');

    // 6. Create Permission Set (XML Only)
    createPermissionSet('Offer', ROOT_DIR); 

    // 7. Add to Sales App
    addTabToApp('standard__Sales', 'Offer', ROOT_DIR);

    // 8. Update Page Layouts
    addFieldToLayout('Offer-Offer Layout', 'Offer_Amount__c', ROOT_DIR);
    addFieldToLayout('Offer-Offer Layout', 'Target_Close_Date__c', ROOT_DIR);
    
    console.log('✨ Script Finished Successfully.');
}