// ============================================================================
// 1. IMPORTS
// ============================================================================
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 2. DEFINITIONS
// ============================================================================
export type FieldType = 'Text' | 'Number' | 'Currency' | 'Checkbox' | 'Date' | 'DateTime' | 'Email' | 'Percent' | 'Phone' | 'Url' | 'TextArea';

export interface FieldDefinition {
    name: string;
    type: FieldType;
    description: string;
    required?: boolean;
}

export interface RecordDefinition {
    [key: string]: any;
}

const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];

// ============================================================================
// 3. HELPER: Get Correct Names
// ============================================================================
function getObjectDetails(objectName: string) {
    const isStandard = STANDARD_OBJECTS.includes(objectName);
    const hasSuffix = objectName.endsWith('__c');

    let apiName = objectName;
    let folderName = objectName;

    // Logic: Only add __c if it's NOT a standard object and DOESN'T have it yet.
    if (!isStandard && !hasSuffix) {
        apiName = `${objectName}__c`;
        folderName = `${objectName}__c`;
    }

    return { apiName, folderName };
}

// ============================================================================
// 4. HELPER: Find Fields
// ============================================================================
export function findFields(targetObject: string, rootDir: string): string[] {
    const { folderName } = getObjectDetails(targetObject);
    const objectFolder = path.join(rootDir, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    // If folder doesn't exist, we can't search it.
    if (!fs.existsSync(fieldsFolder)) {
        return [];
    }

    const files = fs.readdirSync(fieldsFolder);
    const requiredFields: string[] = [];

    // Check each file to see if it is required
    files.forEach(file => {
        const content = fs.readFileSync(path.join(fieldsFolder, file), 'utf8');
        const nameMatch = content.match(/<fullName>(.*?)<\/fullName>/);
        const isRequired = content.includes('<required>true</required>');

        if (nameMatch && isRequired) {
            requiredFields.push(nameMatch[1]);
        }
    });
    
    return requiredFields;
}

// ============================================================================
// 5. FUNCTION: Create Records
// ============================================================================
export function createRecords(targetObject: string, recordList: RecordDefinition[], rootDir: string): string {
    const { apiName } = getObjectDetails(targetObject);
    const requiredFieldNames = findFields(targetObject, rootDir);

    const formattedRecords = recordList.map((record, index) => {
        // Auto-fill nulls for missing required fields
        requiredFieldNames.forEach(reqField => {
            if (!record.hasOwnProperty(reqField)) {
                console.log(`⚠️  Warning: Record ${index + 1} missing '${reqField}'. Auto-filling null.`);
                record[reqField] = null;
            }
        });

        // Add Salesforce attributes
        return {
            attributes: {
                type: apiName,
                referenceId: `ref${index}`
            },
            ...record
        };
    });

    // PATH FIX: Use process.cwd() (Project Root) to find the data folder.
    // This is safer than using relative paths (../../..) because it works
    // no matter where the file is located.
    const dataFolder = path.join(process.cwd(), 'data');

    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, { recursive: true });
    }

    const outputPath = path.join(dataFolder, `${targetObject}-data.json`);
    const finalOutput = { records: formattedRecords };
    
    fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 4));
    console.log(`✅ Data File Generated: ${outputPath}`);
    return outputPath;
}

// ============================================================================
// 6. FUNCTION: Create Object
// ============================================================================
export function createObject(parentDirectory: string, objectName: string, label: string, pluralLabel: string): string {
    const { apiName, folderName } = getObjectDetails(objectName);
    const objectFolder = path.join(parentDirectory, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    if (!fs.existsSync(fieldsFolder)) {
        fs.mkdirSync(fieldsFolder, { recursive: true });
    }

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
    return fieldsFolder;
}

// ============================================================================
// 7. FUNCTION: Create Fields
// ============================================================================
export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    fieldList.forEach(field => {
        const apiName = `${field.name}__c`;
        const label = field.name.replace(/_/g, ' '); 
        const isRequired = field.required ? 'true' : 'false';
        let extraTags = '';
        
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
// 8. EXECUTION
// ============================================================================

// Check if we are running this file directly.
// This check (process.argv) works in BOTH CommonJS and ES Modules.
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('createFields.ts');

if (isRunningDirectly) {
    
    // ROOT FIX: process.cwd() gets the folder you ran the command from (Project Root).
    // We append the path to the objects folder.
    const ROOT_DIR = path.join(process.cwd(), 'force-app/main/default/objects');

    // 1. Create Object (Property__c)
    const fieldsPath = createObject(ROOT_DIR, 'Property', 'Property', 'Properties');

    // 2. Define Fields (UPDATED EXAMPLE)
    const myFields: FieldDefinition[] = [
        { name: 'Price', type: 'Currency', description: 'The listed sale price of the home', required: true }
    ];

    // 3. Generate XML
    createFields(fieldsPath, myFields);

    // 4. Create Data for Import (UPDATED EXAMPLE)
    const myRecords: RecordDefinition[] = [
        { 
            Name: 'Luxury Villa',       // Standard Name field
            Price__c: 500000            // Custom Field
        } 
    ];

    createRecords('Property', myRecords, ROOT_DIR);
}