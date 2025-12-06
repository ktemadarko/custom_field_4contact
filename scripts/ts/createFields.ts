// ============================================================================
// 1. IMPORTS
// ============================================================================
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 2. DEFINITIONS (The Contracts)
// ============================================================================

// A list of allowed field types.
export type FieldType = 'Text' | 'Number' | 'Currency' | 'Checkbox' | 'Date' | 'DateTime' | 'Email' | 'Percent' | 'Phone' | 'Url' | 'TextArea';

// The shape of a Field.
export interface FieldDefinition {
    name: string;
    type: FieldType;
    description: string;
    required?: boolean; // Optional: Default is false unless specified
}

// The shape of a Record (Can have any keys).
export interface RecordDefinition {
    [key: string]: any;
}

// ============================================================================
// 3. HELPER: Find Fields (Scans your hard drive)
// ============================================================================
// This looks at the files we just built to see which ones are "Required".
export function findFields(targetObject: string, rootDir: string): string[] {
    const objectFolder = path.join(rootDir, `${targetObject}__c`);
    const fieldsFolder = path.join(objectFolder, 'fields');

    // Safety check: Does the folder exist?
    if (!fs.existsSync(fieldsFolder)) {
        return [];
    }

    // Read all files in the fields folder
    const files = fs.readdirSync(fieldsFolder);
    const requiredFields: string[] = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(fieldsFolder, file), 'utf8');
        const nameMatch = content.match(/<fullName>(.*?)<\/fullName>/);
        
        // Check if the file says <required>true</required>
        const isRequired = content.includes('<required>true</required>');

        if (nameMatch && isRequired) {
            requiredFields.push(nameMatch[1]);
        }
    });
    
    return requiredFields;
}

// ============================================================================
// 4. FUNCTION: Create Records (Formatted for Salesforce Import)
// ============================================================================
export function createRecords(targetObject: string, recordList: RecordDefinition[], rootDir: string): string {
    
    const objectApiName = `${targetObject}__c`;
    
    // 1. Ask the helper: "Which fields MUST be in these records?"
    const requiredFieldNames = findFields(targetObject, rootDir);

    // 2. Loop through every record to clean it up
    const formattedRecords = recordList.map((record, index) => {
        
        // A: Check for missing required fields and fill with null
        requiredFieldNames.forEach(reqField => {
            if (!record.hasOwnProperty(reqField)) {
                console.log(`⚠️  Warning: Record ${index + 1} missing '${reqField}'. Auto-filling null.`);
                record[reqField] = null;
            }
        });

        // B: Add the mandatory Salesforce "attributes"
        return {
            attributes: {
                type: objectApiName,      // "This is a Property__c"
                referenceId: `ref${index}` // Unique ID for this batch
            },
            ...record // Add the rest of the user's data (Price, Address, etc.)
        };
    });

    // 3. Prepare to save the file
    // We navigate 4 levels up to get to the project root (where package.json is)
    // scripts -> ts -> [file] ... needs to go up to Project Root
    const projectRoot = path.resolve(rootDir, '../../../../'); 
    const dataFolder = path.join(projectRoot, 'data');

    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, { recursive: true });
    }

    const outputPath = path.join(dataFolder, `${targetObject}-data.json`);
    
    // 4. Wrap the list in a "records" object (Salesforce requirement)
    const finalOutput = { records: formattedRecords };
    
    // 5. Write the JSON file
    fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 4));
    
    console.log(`✅ Data File Generated: ${outputPath}`);
    return outputPath; // Return the path so tests can find it
}

// ============================================================================
// 5. FUNCTION: Create Object (Standard Scaffolding)
// ============================================================================
export function createObject(parentDirectory: string, objectName: string, label: string, pluralLabel: string): string {
    const objApiName = `${objectName}__c`;
    const objectFolder = path.join(parentDirectory, objApiName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    if (!fs.existsSync(fieldsFolder)) {
        fs.mkdirSync(fieldsFolder, { recursive: true });
    }

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

    fs.writeFileSync(path.join(objectFolder, `${objApiName}.object-meta.xml`), xmlContent);
    return fieldsFolder;
}

// ============================================================================
// 6. FUNCTION: Create Fields
// ============================================================================
export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    
    fieldList.forEach(field => {
        const apiName = `${field.name}__c`;
        const label = field.name.replace(/_/g, ' '); 
        let extraTags = '';
        
        // Ternary Operator: If field.required is true, use 'true', otherwise 'false'
        const isRequired = field.required ? 'true' : 'false';

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

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <type>${field.type}</type>
    <description>${field.description}</description>
    <required>${isRequired}</required>
    ${extraTags}
</CustomField>`;

        fs.writeFileSync(path.join(fieldsDir, `${apiName}.field-meta.xml`), xmlContent);
        console.log(`   Created Field: ${apiName}`);
    });
}

// ============================================================================
// 7. EXECUTION (Runs when you type 'npm run build')
// ============================================================================
if (require.main === module) {
    const ROOT_DIR = path.resolve(__dirname, '../../force-app/main/default/objects');

    // 1. Create Structure
    const fieldsPath = createObject(ROOT_DIR, 'Property', 'Property', 'Properties');

    // 2. Define Fields
    const myFields: FieldDefinition[] = [
        { name: 'Price', type: 'Currency', description: 'The listed sale price of the home', required: true }
    ];

    createFields(fieldsPath, myFields);

    // 3. Create Records
    const myRecords: RecordDefinition[] = [
        { Name: AmaVilla, 
          Price__c: 500000}// Missing Address! Should verify auto-null
    ];

    createRecords('Property', myRecords, ROOT_DIR);
}