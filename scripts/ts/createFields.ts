// ============================================================================
// FILE: scripts/ts/createFields.ts
// PURPOSE: Orchestrates Objects, Fields, Tabs, Apps, and Data
// ============================================================================
import * as fs from 'fs';
import * as path from 'path';

// Import permission set logic (optional use)
import { createPermissionSet } from './createPermissionSet';

// ============================================================================
// DEFINITIONS
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

export interface NameFieldOptions {
    label: string;                  
    type: 'Text' | 'AutoNumber';    
    displayFormat?: string;         
    startingNumber?: number;        
}

const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];

// ============================================================================
// HELPER: Get Correct Names
// ============================================================================
function getObjectDetails(objectName: string) {
    const isStandard = STANDARD_OBJECTS.includes(objectName);
    const hasSuffix = objectName.endsWith('__c');

    let apiName = objectName;
    let folderName = objectName;

    if (!isStandard && !hasSuffix) {
        apiName = `${objectName}__c`;
        folderName = `${objectName}__c`;
    }
    return { apiName, folderName };
}

// ============================================================================
// HELPER: Find Fields
// ============================================================================
export function findFields(targetObject: string, rootDir: string): string[] {
    const { folderName } = getObjectDetails(targetObject);
    const objectFolder = path.join(rootDir, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    if (!fs.existsSync(fieldsFolder)) return [];

    const files = fs.readdirSync(fieldsFolder);
    const requiredFields: string[] = [];

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
// FUNCTION: Create Records (UPDATED with Alert)
// ============================================================================
export function createRecords(
    targetObject: string, 
    recordList: RecordDefinition[], 
    rootDir: string,
    nameFieldOptions?: NameFieldOptions // NEW ARGUMENT to check AutoNumber
): string {
    const { apiName } = getObjectDetails(targetObject);
    const requiredFieldNames = findFields(targetObject, rootDir);

    // ALERT: Check if Name is AutoNumber
    if (nameFieldOptions && nameFieldOptions.type === 'AutoNumber') {
        console.log(`ℹ️  Note: Object '${targetObject}' uses AutoNumber. You do not need to provide a 'Name' field.`);
    }

    const formattedRecords = recordList.map((record, index) => {
        
        // Safety Check: If user provided 'Name' for an AutoNumber object, warn them.
        if (nameFieldOptions?.type === 'AutoNumber' && record.hasOwnProperty('Name')) {
            console.log(`⚠️  Warning: You provided a 'Name' for Record ${index + 1}, but this object is AutoNumber. Salesforce will ignore your value.`);
            // We delete it so it doesn't cause conflicts
            delete record['Name']; 
        }

        requiredFieldNames.forEach(reqField => {
            if (!record.hasOwnProperty(reqField)) {
                console.log(`⚠️  Warning: Record ${index + 1} missing '${reqField}'. Auto-filling null.`);
                record[reqField] = null;
            }
        });
        
        return {
            attributes: { type: apiName, referenceId: `ref${index}` },
            ...record
        };
    });

    const dataFolder = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder, { recursive: true });

    const outputPath = path.join(dataFolder, `${targetObject}-data.json`);
    const finalOutput = { records: formattedRecords };
    
    fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 4));
    console.log(`✅ Data File Generated: ${outputPath}`);
    return outputPath;
}

// ============================================================================
// FUNCTION: Create Object
// ============================================================================
export function createObject(
    parentDirectory: string, 
    objectName: string, 
    label: string, 
    pluralLabel: string,
    nameFieldOptions?: NameFieldOptions 
): string {
    const { apiName, folderName } = getObjectDetails(objectName);
    const objectFolder = path.join(parentDirectory, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    if (!fs.existsSync(fieldsFolder)) fs.mkdirSync(fieldsFolder, { recursive: true });

    let nameFieldXml = '';

    if (!nameFieldOptions) {
        nameFieldXml = `
    <nameField>
        <label>${label} Name</label>
        <type>Text</type>
    </nameField>`;
    } else {
        if (nameFieldOptions.type === 'AutoNumber') {
            if (!nameFieldOptions.displayFormat) throw new Error("AutoNumber requires a displayFormat (e.g. OF-{0000})");
            
            nameFieldXml = `
    <nameField>
        <displayFormat>${nameFieldOptions.displayFormat}</displayFormat>
        <label>${nameFieldOptions.label}</label>
        <type>AutoNumber</type>
        <startingNumber>${nameFieldOptions.startingNumber || 1}</startingNumber>
    </nameField>`;
        } else {
            nameFieldXml = `
    <nameField>
        <label>${nameFieldOptions.label}</label>
        <type>Text</type>
    </nameField>`;
        }
    }

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <pluralLabel>${pluralLabel}</pluralLabel>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <enableSharing>true</enableSharing>
    <enableBulkApi>true</enableBulkApi>
    <enableStreamingApi>true</enableStreamingApi>
    <enableActivities>true</enableActivities>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    ${nameFieldXml}
</CustomObject>`;

    fs.writeFileSync(path.join(objectFolder, `${apiName}.object-meta.xml`), xmlContent);
    return fieldsFolder;
}

// ============================================================================
// FUNCTION: Create Fields
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
// FUNCTION: Create Tab
// ============================================================================
export function createTab(targetObject: string, rootDir: string, iconStyle: string): void {
    const { apiName } = getObjectDetails(targetObject);
    const tabsFolder = path.join(rootDir, '..', 'tabs');
    
    if (!fs.existsSync(tabsFolder)) fs.mkdirSync(tabsFolder, { recursive: true });

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
    <customObject>true</customObject>
    <motif>${iconStyle}</motif>
    <description>Created via automation script</description>
</CustomTab>`;

    fs.writeFileSync(path.join(tabsFolder, `${apiName}.tab-meta.xml`), xmlContent);
    console.log(`✨ Created Tab: ${apiName}`);
}

// ============================================================================
// FUNCTION: Add Tab to App
// ============================================================================
export function addTabToApp(targetApp: string, targetObject: string, rootDir: string): void {
    const { apiName } = getObjectDetails(targetObject);
    const appFileName = targetApp.endsWith('.app-meta.xml') ? targetApp : `${targetApp}.app-meta.xml`;
    const appsFolder = path.join(rootDir, '..', 'applications');
    const appPath = path.join(appsFolder, appFileName);

    if (!fs.existsSync(appPath)) {
        console.log(`❌ Error: App file ${appPath} not found.`);
        return;
    }

    let content = fs.readFileSync(appPath, 'utf8');
    const tabTag = `<tabs>${apiName}</tabs>`;

    if (content.includes(tabTag)) {
        console.log(`ℹ️  Tab ${apiName} is already in ${targetApp}`);
        return;
    }

    if (content.includes('</tabs>')) {
        const lastTabRegex = /(<tabs>.*?<\/tabs>)(?![\s\S]*<tabs>)/;
        content = content.replace(lastTabRegex, `$1\n    ${tabTag}`);
    } else {
        content = content.replace('</CustomApplication>', `    ${tabTag}\n</CustomApplication>`);
    }

    fs.writeFileSync(appPath, content);
    console.log(`✅ Added ${apiName} to App: ${targetApp}`);
}