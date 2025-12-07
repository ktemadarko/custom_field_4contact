// ============================================================================
// 1. IMPORTS
// ============================================================================
// We need 'fs' to read/write files and 'path' to manage folder addresses.
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 2. DEFINITIONS (The Rules)
// ============================================================================

// Type Alias: Restricts the values the user can type for a field type.
export type FieldType = 'Text' | 'Number' | 'Currency' | 'Checkbox' | 'Date' | 'DateTime' | 'Email' | 'Percent' | 'Phone' | 'Url' | 'TextArea';

// Interface: Defines what a "Field" looks like in our code.
export interface FieldDefinition {
    name: string;          // The internal name (e.g., "Start_Date")
    type: FieldType;       // The data type (must match the list above)
    description: string;   // Helpful text for the admin
    required?: boolean;    // Optional: Is this field mandatory? (true/false)
}

// Interface: Defines a "Record" (Data). It can have any property names.
export interface RecordDefinition {
    [key: string]: any;    // Allows any key (like "Price__c") with any value.
}

// CONSTANT: A list of standard Salesforce objects that DO NOT use '__c'.
const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];

// ============================================================================
// 3. HELPER: Get Correct Names (Smart Logic)
// ============================================================================
// This helper figures out if we need to add '__c' or not.
function getObjectDetails(objectName: string) {
    // Check if the name is in our list of Standard Objects (e.g. 'Account')
    const isStandard = STANDARD_OBJECTS.includes(objectName);
    
    // Check if the user already typed '__c' manually
    const hasSuffix = objectName.endsWith('__c');

    let apiName = objectName;
    let folderName = objectName;

    // RULE: If it is NOT standard and DOES NOT have suffix, we treat it as Custom.
    // Example: "Property" -> "Property__c"
    // Example: "Account"  -> "Account"
    if (!isStandard && !hasSuffix) {
        apiName = `${objectName}__c`;
        folderName = `${objectName}__c`;
    }

    return { apiName, folderName };
}

// ============================================================================
// 4. HELPER: Find Fields (Scans the folder)
// ============================================================================
export function findFields(targetObject: string, rootDir: string): string[] {
    
    // 1. Get the correct folder name (Account vs Property__c)
    const { folderName } = getObjectDetails(targetObject);

    // 2. Build the full path to the 'fields' folder
    const objectFolder = path.join(rootDir, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    // 3. Safety Check: If the folder doesn't exist, we can't find fields.
    if (!fs.existsSync(fieldsFolder)) {
        return []; // Return an empty list
    }

    // 4. Read all filenames in that folder
    const files = fs.readdirSync(fieldsFolder);
    const requiredFields: string[] = [];

    // 5. Loop through each file to check if it is required
    files.forEach(file => {
        // Read the file content
        const content = fs.readFileSync(path.join(fieldsFolder, file), 'utf8');
        
        // Regex: Find the text between <fullName> tags
        const nameMatch = content.match(/<fullName>(.*?)<\/fullName>/);
        
        // Check: Does the file contain the required tag set to true?
        const isRequired = content.includes('<required>true</required>');

        // If we found a name AND it is required, add it to our list.
        if (nameMatch && isRequired) {
            requiredFields.push(nameMatch[1]);
        }
    });
    
    return requiredFields;
}

// ============================================================================
// 5. FUNCTION: Create Records (The Data Generator)
// ============================================================================
export function createRecords(targetObject: string, recordList: RecordDefinition[], rootDir: string): string {
    
    // 1. Get correct API Name (Account vs Property__c) for the 'attributes' tag
    const { apiName } = getObjectDetails(targetObject);
    
    // 2. Scan the folder to see which fields are legally required
    const requiredFieldNames = findFields(targetObject, rootDir);

    // 3. Process the user's records
    const formattedRecords = recordList.map((record, index) => {
        
        // A. Auto-Null Logic: Fill missing required fields
        requiredFieldNames.forEach(reqField => {
            // "If the record does NOT have this key..."
            if (!record.hasOwnProperty(reqField)) {
                console.log(`⚠️  Warning: Record ${index + 1} missing '${reqField}'. Auto-filling null.`);
                record[reqField] = null; // Force it to null
            }
        });

        // B. Add Salesforce Attributes (Required for Import)
        return {
            attributes: {
                type: apiName,            // e.g. "Property__c" or "Account"
                referenceId: `ref${index}` // Unique ID for this batch
            },
            ...record // Spread Operator: Copies all user data (Price, Name, etc.)
        };
    });

    // 4. Save the File
    // We navigate 4 levels UP from 'force-app/main/default/objects' to get to Project Root
    const projectRoot = path.resolve(rootDir, '../../../../'); 
    const dataFolder = path.join(projectRoot, 'data');

    // Create 'data' folder if missing
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, { recursive: true });
    }

    // Define output filename
    const outputPath = path.join(dataFolder, `${targetObject}-data.json`);
    
    // Wrap in "records" object
    const finalOutput = { records: formattedRecords };
    
    // Write to disk (formatted with 4 spaces)
    fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 4));
    
    console.log(`✅ Data File Generated: ${outputPath}`);
    return outputPath;
}

// ============================================================================
// 6. FUNCTION: Create Object (The Structure Builder)
// ============================================================================
export function createObject(parentDirectory: string, objectName: string, label: string, pluralLabel: string): string {
    
    // 1. Get correct names
    const { apiName, folderName } = getObjectDetails(objectName);
    
    // 2. Build paths
    const objectFolder = path.join(parentDirectory, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    // 3. Create folders recursively
    if (!fs.existsSync(fieldsFolder)) {
        fs.mkdirSync(fieldsFolder, { recursive: true });
    }

    // 4. Write the Object XML
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <pluralLabel>${pluralLabel}</pluralLabel>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <nameField>
        <label>${label} Name</label>
        <type>Text</type>
    </nameField>
</CustomObject>`;

    fs.writeFileSync(path.join(objectFolder, `${apiName}.object-meta.xml`), xmlContent);
    return fieldsFolder; // Return path so next function knows where to put fields
}

// ============================================================================
// 7. FUNCTION: Create Fields (The Field Builder)
// ============================================================================
export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    
    fieldList.forEach(field => {
        // Construct API Name (Fields always get __c, even on Standard Objects if custom)
        const apiName = `${field.name}__c`;
        const label = field.name.replace(/_/g, ' '); // Replace underscores with spaces

        let extraTags = '';
        
        // Logic: Decide required status (Text string 'true' or 'false')
        const isRequired = field.required ? 'true' : 'false';

        // Switch: Add specific tags based on type
        switch (field.type) {
            case 'Currency':
            case 'Percent':
                extraTags = '<precision>18</precision>\n    <scale>2</scale>';
                break;
            case 'Number':
                extraTags = '<precision>18</precision>\n    <scale>0</scale>';
                break;
            case 'Text':
            case 'Email':
            case 'Url':
            case 'Phone':
                extraTags = '<length>255</length>';
                break;
        }

        // Build XML
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <type>${field.type}</type>
    <description>${field.description}</description>
    <required>${isRequired}</required>
    ${extraTags}
</CustomField>`;

        // Write File
        fs.writeFileSync(path.join(fieldsDir, `${apiName}.field-meta.xml`), xmlContent);
        console.log(`   Created Field: ${apiName}`);
    });
}

// ============================================================================
// 8. EXECUTION (ES Module Compatible (Runs when 'npm run build' is called)
// ============================================================================

// NEW: Recreate __filename and __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NEW: The ES Module way to check "Am I running directly?"
// We compare the file path of the current script to the file path Node is executing.
if (process.argv[1] === __filename) {
    
    // Now __dirname works correctly!
    const ROOT_DIR = path.resolve(__dirname, '../../force-app/main/default/objects');

    const fieldsPath = createObject(ROOT_DIR, 'Property', 'Property', 'Properties');

    // 2. Define Fields
    const myFields: FieldDefinition[] = [
        { name: 'Price', type: 'Currency', description: 'The listed sale price of the home', required: true }
    
        
    ];

    // 3. Generate XML
    createFields(fieldsPath, myFields);

    // 4. Create Data for Import
    const myRecords: RecordDefinition[] = [
        { 
            Name: 'Luxury Villa',       // Standard Name field
            Price__c: 500000
        } 
    ];

    createRecords('Property', myRecords, ROOT_DIR);
}
