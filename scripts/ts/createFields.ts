// ============================================================================
// 1. IMPORTS
// ============================================================================
// We import built-in Node.js tools.
// 'fs' (File System) lets us create folders and write files.
// 'path' helps us combine folder names safely (e.g., handles '/' vs '\' on Windows).
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 2. TYPESCRIPT DEFINITIONS (The Rules)
// ============================================================================

// A "Type Alias". This is a custom list of allowed text strings.
// If you try to use a type that isn't in this list (like "Money"), TypeScript will show an error.
export type FieldType = 
    | 'Text' 
    | 'Number' 
    | 'Currency' 
    | 'Checkbox' 
    | 'Date' 
    | 'DateTime' 
    | 'Email' 
    | 'Percent' 
    | 'Phone' 
    | 'Url' 
    | 'TextArea';

// An "Interface". This defines the shape of a "Field" object.
// It ensures every field we try to create has a name, a valid type, and a description.
export interface FieldDefinition {
    name: string;          // e.g., "Start_Date"
    type: FieldType;       // Must be one of the options above
    description: string;   // e.g., "The day the project starts"
}

// ============================================================================
// 3. HELPER FUNCTION: Create the Object Folder & XML
// ============================================================================
export function createObject(parentDirectory: string, objectName: string, label: string, pluralLabel: string): string {
    
    // 1. Construct the API Name (e.g., "Property" becomes "Property__c")
    const objApiName = `${objectName}__c`;

    // 2. Build the full folder path
    // path.join combines parts: "force-app/objects" + "Property__c"
    const objectFolder = path.join(parentDirectory, objApiName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    // 3. Create the folders on your hard drive
    // { recursive: true } means "create the parent folder too if it's missing"
    if (!fs.existsSync(fieldsFolder)) {
        fs.mkdirSync(fieldsFolder, { recursive: true });
    }

    // 4. Define the XML content for the Object
    // We use 4 spaces for indentation to match Salesforce standards.
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${objApiName}</fullName>
    <label>${label}</label>
    <pluralLabel>${pluralLabel}</pluralLabel>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <nameField>
        <label>${label} Name</label>
        <type>Text</type>
    </nameField>
</CustomObject>`;

    // 5. Write the file to disk
    fs.writeFileSync(path.join(objectFolder, `${objApiName}.object-meta.xml`), xmlContent);
    console.log(`✅ Created Object: ${objApiName}`);
    
    // Return the path to the fields folder so the next function knows where to look
    return fieldsFolder;
}

// ============================================================================
// 4. MAIN FUNCTION: Create the Field XMLs
// ============================================================================
export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    
    // Loop through every field in our list
    fieldList.forEach(field => {
        
        // Prepare names
        const apiName = `${field.name}__c`;
        
        // Regex magic: Replace ALL underscores ('_') with spaces (' ') for the human-readable label
        const label = field.name.replace(/_/g, ' '); 

        // LOGIC: Add specific XML tags based on the data type
        let extraTags = '';
        
        switch (field.type) {
            case 'Currency':
            case 'Percent':
                // Money and Percents need decimal places
                extraTags = '<precision>18</precision>\n    <scale>2</scale>';
                break;
            case 'Number':
                // Standard numbers usually have 0 decimals
                extraTags = '<precision>18</precision>\n    <scale>0</scale>';
                break;
            case 'Text':
            case 'Email':
            case 'Url':
            case 'Phone':
                // Text fields need a character limit
                extraTags = '<length>255</length>';
                break;
            // Dates and Checkboxes don't need extra tags, so we do nothing.
        }

        // Build the XML string
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <type>${field.type}</type>
    <description>${field.description}</description>
    <required>false</required>
    ${extraTags}
</CustomField>`;

        // Write the file
        fs.writeFileSync(path.join(fieldsDir, `${apiName}.field-meta.xml`), xmlContent);
        console.log(`   Created Field: ${apiName}`);
    });
}

// ============================================================================
// 5. EXECUTION (The part that actually runs)
// ============================================================================
// "if (require.main === module)" is a Node.js trick.
// It means: "Only run this code if I called this file directly from the terminal."
if (require.main === module) {
    
    // PATH FIX: Since this file is now in 'scripts/ts/', we need to go UP two levels
    // to find 'force-app'.
    // __dirname = The folder this script is currently inside (scripts/ts)
    // '../..'   = Go up two levels (to project root)
    const ROOT_DIR = path.resolve(__dirname, '../../force-app/main/default/objects');

    // 1. Create Object
    const fieldsPath = createObject(ROOT_DIR, 'Property', 'Property', 'Properties');

    // 2. Define Fields
    const myFields: FieldDefinition[] = [
        { name: 'Price', type: 'Currency', description: 'The listed sale price' },
        { name: 'Listing_Date', type: 'Date', description: 'Date went on market' },
        { name: 'Open_House_Time', type: 'DateTime', description: 'Next event time' },
        { name: 'Address', type: 'Text', description: 'Street address' },
        { name: 'Commission_Rate', type: 'Percent', description: 'Agent cut' },
        { name: 'Zillow_Link', type: 'Url', description: 'External link' }
    ];

    // 3. Generate Files
    createFields(fieldsPath, myFields);
}