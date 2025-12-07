// ============================================================================
// FILE: scripts/ts/runFieldsExercise.ts
// PURPOSE: Creates Objects, Fields, Tabs, Apps, and Data
// ============================================================================
// We import it, but we won't use it in the execution block below
import * from './createFields';
// ============================================================================
// EXECUTION
// ============================================================================
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('createFields.ts');

if (isRunningDirectly) {
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
    // createPermissionSet('Property', ROOT_DIR); 

    // 6. Add to Sales App
    // Since 'Property' is passed, getObjectDetails converts it to 'Property__c' internally
    addTabToApp('standard__Sales', 'Property', ROOT_DIR);

    // 7. Create Data
    const myRecords: RecordDefinition[] = [
        { Name: 'Luxury Villa', Price__c: 500000 } 
    ];
    createRecords('Property', myRecords, ROOT_DIR);
}